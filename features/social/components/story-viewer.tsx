"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  autoplayVideo = true,
  dataSaving = false,
}: {
  story: Story;
  fallbackProfile: Profile;
  currentUserId: string;
  mediaUrl: (path: string) => string;
  onClose: () => void;
  onViewed?: () => void;
  autoplayVideo?: boolean;
  dataSaving?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const author = story.profile || fallbackProfile;
  const own = story.author_id === currentUserId;
  const [viewers, setViewers] = useState<StoryViewerPerson[]>([]);
  const [showViewers, setShowViewers] = useState(false);

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

  return (
    <div
      className="modal story-viewer-shell"
      role="dialog"
      aria-modal="true"
      aria-label="Story"
      onClick={onClose}
    >
      <div className="story-viewer" onClick={(event) => event.stopPropagation()}>
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
                @{author.username} · {formatRelativeTime(story.created_at)}
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

        {story.media_type === "video" ? (
          <video
            src={mediaUrl(story.media_path)}
            controls
            autoPlay={autoplayVideo}
            muted={autoplayVideo}
            preload={dataSaving ? "none" : "metadata"}
            playsInline
            className="story-viewer-media"
          />
        ) : (
          <UserMediaImage
            src={mediaUrl(story.media_path)}
            alt="Story"
            className="story-viewer-media"
            width={story.media_width}
            height={story.media_height}
            loading="eager"
          />
        )}

        <div className="story-viewer-foot">
          <small className="story-expiry">
            Expires {new Date(story.expires_at).toLocaleString()}
          </small>

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
