"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import Icon from "./icon";
import UserMediaImage from "./user-media-image";

type HighlightRow = {
  highlight_id: string;
  highlight_title: string;
  highlight_visibility: "everyone" | "followers" | "close_friends";
  highlight_created_at: string;
  cover_story_id: string | null;
  story_id: string;
  media_path: string;
  media_type: "image" | "video";
  media_width: number | null;
  media_height: number | null;
  caption: string;
  story_created_at: string;
  item_position: number;
};

type HighlightGroup = {
  id: string;
  title: string;
  visibility: HighlightRow["highlight_visibility"];
  coverStoryId: string | null;
  stories: HighlightRow[];
};

export default function ProfileHighlightsRow({
  profileId,
  own = false,
}: {
  profileId: string;
  own?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [groups, setGroups] = useState<HighlightGroup[]>([]);
  const [active, setActive] = useState<{ group: number; story: number } | null>(
    null
  );

  const mediaUrl = useCallback(
    (path: string) =>
      supabase.storage.from("media").getPublicUrl(path).data.publicUrl,
    [supabase]
  );

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_profile_highlights", {
      target_user: profileId,
    });
    if (error) return;

    const rows = (data || []) as HighlightRow[];
    const map = new Map<string, HighlightGroup>();

    for (const row of rows) {
      let group = map.get(row.highlight_id);
      if (!group) {
        group = {
          id: row.highlight_id,
          title: row.highlight_title,
          visibility: row.highlight_visibility,
          coverStoryId: row.cover_story_id,
          stories: [],
        };
        map.set(row.highlight_id, group);
      }
      group.stories.push(row);
    }

    setGroups([...map.values()]);
  }, [profileId, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const activeGroup = active ? groups[active.group] : null;
  const activeStory =
    activeGroup && active ? activeGroup.stories[active.story] : null;

  if (!groups.length && !own) return null;

  return (
    <>
      <section className="profile-highlights-row" aria-label="Story Highlights">
        <div className="profile-highlights-scroll">
          {groups.map((group, groupIndex) => {
            const cover =
              group.stories.find(
                (story) => story.story_id === group.coverStoryId
              ) || group.stories[0];

            return (
              <button
                key={group.id}
                type="button"
                className="profile-highlight"
                onClick={() => setActive({ group: groupIndex, story: 0 })}
              >
                <span className="profile-highlight-cover">
                  {cover?.media_type === "video" ? (
                    <video
                      src={cover ? mediaUrl(cover.media_path) : undefined}
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : cover ? (
                    <UserMediaImage
                      src={mediaUrl(cover.media_path)}
                      alt={group.title}
                      loading="lazy"
                    />
                  ) : (
                    <i>A</i>
                  )}
                </span>
                <small>{group.title}</small>
              </button>
            );
          })}

          {own && (
            <Link className="profile-highlight manage" href="/settings/archive">
              <span className="profile-highlight-cover">
                <Icon name="plus" size={24} />
              </span>
              <small>New</small>
            </Link>
          )}
        </div>
      </section>

      {activeGroup && activeStory && active && (
        <div
          className="modal highlight-viewer-shell"
          role="dialog"
          aria-modal="true"
          aria-label={activeGroup.title}
          onClick={() => setActive(null)}
        >
          <div
            className="highlight-viewer"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <small>HIGHLIGHT</small>
                <b>{activeGroup.title}</b>
              </div>
              <button
                type="button"
                onClick={() => setActive(null)}
                aria-label="Close Highlight"
              >
                <Icon name="close" size={18} />
              </button>
            </header>

            <div className="highlight-progress">
              {activeGroup.stories.map((story, index) => (
                <i
                  key={story.story_id}
                  className={index <= active.story ? "active" : ""}
                />
              ))}
            </div>

            <div className="highlight-media">
              {activeStory.media_type === "video" ? (
                <video
                  key={activeStory.story_id}
                  src={mediaUrl(activeStory.media_path)}
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <UserMediaImage
                  key={activeStory.story_id}
                  src={mediaUrl(activeStory.media_path)}
                  alt={activeStory.caption || activeGroup.title}
                  width={activeStory.media_width}
                  height={activeStory.media_height}
                  loading="eager"
                />
              )}

              <button
                type="button"
                className="highlight-nav previous"
                disabled={active.story === 0}
                onClick={() =>
                  setActive({
                    group: active.group,
                    story: Math.max(0, active.story - 1),
                  })
                }
                aria-label="Previous Highlight Story"
              >
                ‹
              </button>

              <button
                type="button"
                className="highlight-nav next"
                disabled={active.story >= activeGroup.stories.length - 1}
                onClick={() =>
                  setActive({
                    group: active.group,
                    story: Math.min(
                      activeGroup.stories.length - 1,
                      active.story + 1
                    ),
                  })
                }
                aria-label="Next Highlight Story"
              >
                ›
              </button>
            </div>

            {activeStory.caption && <p>{activeStory.caption}</p>}
          </div>
        </div>
      )}
    </>
  );
}
