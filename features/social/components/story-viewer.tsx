"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "../../../lib/supabase/client";
import AvatarImage from "./avatar-image";
import UserMediaImage from "./user-media-image";
import Icon from "./icon";
import { avatarFor, formatRelativeTime } from "../lib/profile";
import type { Profile, Story } from "../types";

type StoryViewerPerson = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  verified?: boolean;
  viewed_at: string;
};

export default function StoryViewer({
  story,
  fallbackProfile,
  currentUserId,
  mediaUrl,
  onClose,
  onViewed,
  onPrevious,
  onNext,
  hasPrevious = false,
  position = 0,
  total = 1,
  autoplayVideo = true,
  dataSaving = false,
}: {
  story: Story;
  fallbackProfile: Profile;
  currentUserId: string;
  mediaUrl: (path: string) => string;
  onClose: () => void;
  onViewed?: () => void;
  onPrevious?: () => void;
  onNext: () => void;
  hasPrevious?: boolean;
  position?: number;
  total?: number;
  autoplayVideo?: boolean;
  dataSaving?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const fallbackMatchesAuthor = fallbackProfile.id === story.author_id;
  const author: Profile =
    story.profile ||
    (fallbackMatchesAuthor
      ? fallbackProfile
      : {
          id: story.author_id,
          username: "",
          display_name: "Account unavailable",
          bio: "",
          avatar_url: null,
        });
  const own = story.author_id === currentUserId;
  const [viewers, setViewers] = useState<StoryViewerPerson[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const progressRef = useRef<HTMLElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const progressTotal = Math.max(1, total);
  const progressPosition = Math.max(
    0,
    Math.min(position, progressTotal - 1)
  );

  const loadViewers = useCallback(async () => {
    if (!own) return;

    const viewsResult = await supabase
      .from("story_views")
      .select("viewer_id,viewed_at")
      .eq("story_id", story.id)
      .order("viewed_at", { ascending: false });

    if (viewsResult.error) return;

    const rows = viewsResult.data || [];
    const ids = [...new Set(rows.map((row) => row.viewer_id))];

    if (!ids.length) {
      setViewers([]);
      return;
    }

    const profilesResult = await supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url,verified")
      .in("id", ids);

    if (profilesResult.error) return;

    const profileMap = new Map(
      (profilesResult.data || []).map((profile) => [profile.id, profile])
    );

    setViewers(
      rows.flatMap((row) => {
        const profile = profileMap.get(row.viewer_id);
        return profile
          ? [{
              ...profile,
              viewed_at: row.viewed_at,
            } as StoryViewerPerson]
          : [];
      })
    );
  }, [own, story.id, supabase]);

  useEffect(() => {
    if (own) {
      const timer = window.setTimeout(() => {
        void loadViewers();
      }, 0);

      const channel = supabase
        .channel("avenzo-story-views-" + story.id)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "story_views",
            filter: "story_id=eq." + story.id,
          },
          () => void loadViewers()
        )
        .subscribe();

      return () => {
        window.clearTimeout(timer);
        void supabase.removeChannel(channel);
      };
    }

    const timer = window.setTimeout(() => {
      void supabase
        .from("story_views")
        .upsert(
          {
            story_id: story.id,
            viewer_id: currentUserId,
            viewed_at: new Date().toISOString(),
          },
          { onConflict: "story_id,viewer_id" }
        )
        .then(() => onViewed?.());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    currentUserId,
    loadViewers,
    onViewed,
    own,
    story.id,
    supabase,
  ]);

  useEffect(() => {
    if (
      story.media_type !== "image" ||
      showViewers
    ) {
      return;
    }

    const timer = window.setTimeout(onNext, 5000);
    return () => window.clearTimeout(timer);
  }, [onNext, showViewers, story.id, story.media_type]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowRight") {
        onNext();
      } else if (event.key === "ArrowLeft" && onPrevious) {
        onPrevious();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, onNext, onPrevious]);

  return (
    <div
      className="modal story-viewer-shell"
      role="dialog"
      aria-modal="true"
      aria-label="Story"
      onClick={onClose}
    >
      <div
        className="story-viewer"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => {
          touchStartY.current = event.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(event) => {
          const startY = touchStartY.current;
          const endY = event.changedTouches[0]?.clientY;
          touchStartY.current = null;

          if (
            startY !== null &&
            typeof endY === "number" &&
            endY - startY > 80
          ) {
            onClose();
          }
        }}
      >
        <div
          className="story-progress-row"
          aria-label={
            "Story " +
            (progressPosition + 1) +
            " of " +
            progressTotal
          }
        >
          {Array.from({ length: progressTotal }, (_, index) => (
            <span
              key={story.author_id + "-progress-" + index}
              className={
                index < progressPosition
                  ? "complete"
                  : index === progressPosition
                    ? "active"
                    : ""
              }
            >
              <i
                key={
                  index === progressPosition
                    ? story.id
                    : story.author_id + "-" + index
                }
                ref={
                  index === progressPosition
                    ? (node) => {
                        progressRef.current = node;
                      }
                    : undefined
                }
                className={
                  index === progressPosition &&
                  story.media_type === "image"
                    ? "story-image-progress"
                    : ""
                }
                style={
                  index === progressPosition &&
                  story.media_type === "image" &&
                  showViewers
                    ? { animationPlayState: "paused" }
                    : undefined
                }
              />
            </span>
          ))}
        </div>

        <div className="story-viewer-head">
          <div className="person-line">
            <AvatarImage
              src={avatarFor(author)}
              alt={author.display_name}
              size={80}
            />
            <div>
              <b>{author.display_name}</b>
              <small>
                {author.username ? "@" + author.username + " · " : ""}
                {formatRelativeTime(story.created_at)}
              </small>
            </div>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close story"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="story-media-stage">
          {story.media_type === "video" ? (
            <video
              src={mediaUrl(story.media_path)}
              controls
              autoPlay={autoplayVideo}
              muted={autoplayVideo}
              preload={dataSaving ? "none" : "metadata"}
              playsInline
              className="story-viewer-media"
              onLoadedMetadata={() => {
                if (progressRef.current) {
                  progressRef.current.style.transform = "scaleX(0)";
                }
              }}
              onTimeUpdate={(event) => {
                const video = event.currentTarget;
                if (!progressRef.current || !Number.isFinite(video.duration)) {
                  return;
                }

                const ratio =
                  video.duration > 0
                    ? Math.max(0, Math.min(1, video.currentTime / video.duration))
                    : 0;
                progressRef.current.style.transform = "scaleX(" + ratio + ")";
              }}
              onEnded={() => {
                if (progressRef.current) {
                  progressRef.current.style.transform = "scaleX(1)";
                }
                onNext();
              }}
            />
          ) : (
            <UserMediaImage
              src={mediaUrl(story.media_path)}
              alt={story.caption || "Story"}
              className="story-viewer-media"
              width={story.media_width}
              height={story.media_height}
              loading="eager"
            />
          )}

          {hasPrevious && onPrevious && (
            <button
              type="button"
              className="story-tap-zone story-tap-zone-left"
              onClick={onPrevious}
              aria-label="Previous story"
            />
          )}
          <button
            type="button"
            className="story-tap-zone story-tap-zone-right"
            onClick={onNext}
            aria-label="Next story"
          />
        </div>

        <div className="story-viewer-foot">
          <div className="story-foot-copy">
            {story.caption && <p>{story.caption}</p>}
            <small className="story-expiry">
              Expires {new Date(story.expires_at).toLocaleString()}
            </small>
          </div>

          {own && (
            <button
              type="button"
              className="story-viewers-button"
              onClick={() => setShowViewers((value) => !value)}
            >
              Seen by {viewers.length}
            </button>
          )}
        </div>

        {own && showViewers && (
          <div className="story-viewers-panel">
            <div className="story-viewers-panel-head">
              <b>Story viewers</b>
              <span>{viewers.length}</span>
            </div>

            {viewers.length === 0 ? (
              <p>No one has viewed this Story yet.</p>
            ) : (
              <div className="story-viewers-list">
                {viewers.map((viewer) => (
                  <div key={viewer.id}>
                    <AvatarImage
                      src={avatarFor({
                        id: viewer.id,
                        username: viewer.username,
                        display_name: viewer.display_name,
                        bio: "",
                        avatar_url: viewer.avatar_url,
                        verified: viewer.verified,
                      })}
                      alt={viewer.display_name}
                      size={64}
                    />
                    <span>
                      <b>{viewer.display_name}</b>
                      <small>
                        @{viewer.username} · {formatRelativeTime(viewer.viewed_at)}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
