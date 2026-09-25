"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import UserMediaImage from "../../social/components/user-media-image";

type ArchiveStory = {
  story_id: string;
  media_path: string;
  media_type: "image" | "video";
  media_width: number | null;
  media_height: number | null;
  caption: string;
  created_at: string;
  expires_at: string;
};

type Highlight = {
  id: string;
  user_id: string;
  title: string;
  visibility: "everyone" | "followers" | "close_friends";
  cover_story_id: string | null;
  created_at: string;
  updated_at: string;
};

type HighlightItem = {
  highlight_id: string;
  story_id: string;
  position: number;
  added_at: string;
};

export default function StoryArchiveHighlightsClient({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [archive, setArchive] = useState<ArchiveStory[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [items, setItems] = useState<HighlightItem[]>([]);
  const [selectedHighlight, setSelectedHighlight] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newVisibility, setNewVisibility] =
    useState<Highlight["visibility"]>("followers");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyStory, setBusyStory] = useState("");

  const mediaUrl = useCallback(
    (path: string) =>
      supabase.storage.from("media").getPublicUrl(path).data.publicUrl,
    [supabase]
  );

  const load = useCallback(async () => {
    setLoading(true);

    const [archiveResult, highlightsResult] = await Promise.all([
      supabase.rpc("get_own_story_archive"),
      supabase
        .from("story_highlights")
        .select("*")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: true }),
    ]);

    if (archiveResult.error || highlightsResult.error) {
      setStatus("Story Archive could not be loaded.");
      setLoading(false);
      return;
    }

    const nextHighlights = (highlightsResult.data || []) as Highlight[];
    const ids = nextHighlights.map((highlight) => highlight.id);

    const itemResult = ids.length
      ? await supabase
          .from("story_highlight_items")
          .select("*")
          .in("highlight_id", ids)
          .order("position", { ascending: true })
      : { data: [], error: null };

    if (itemResult.error) {
      setStatus("Highlight items could not be loaded.");
      setLoading(false);
      return;
    }

    setArchive((archiveResult.data || []) as ArchiveStory[]);
    setHighlights(nextHighlights);
    setItems((itemResult.data || []) as HighlightItem[]);

    if (
      selectedHighlight &&
      !nextHighlights.some((highlight) => highlight.id === selectedHighlight)
    ) {
      setSelectedHighlight("");
    }

    setStatus("");
    setLoading(false);
  }, [currentUserId, selectedHighlight, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createHighlight() {
    const title = newTitle.trim().slice(0, 40);
    if (!title) {
      setStatus("Add a title for the Highlight.");
      return;
    }

    const { data, error } = await supabase
      .from("story_highlights")
      .insert({
        user_id: currentUserId,
        title,
        visibility: newVisibility,
      })
      .select("*")
      .single();

    if (error || !data) {
      setStatus("Highlight could not be created.");
      return;
    }

    setNewTitle("");
    setSelectedHighlight(data.id);
    await load();
    setStatus("Highlight created. Choose Stories below to add.");
  }

  async function renameHighlight(highlight: Highlight) {
    const raw = window.prompt("Highlight title", highlight.title);
    const title = raw?.trim().slice(0, 40);
    if (!title || title === highlight.title) return;

    const { error } = await supabase
      .from("story_highlights")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", highlight.id)
      .eq("user_id", currentUserId);

    if (error) {
      setStatus("Highlight could not be renamed.");
      return;
    }

    await load();
  }

  async function updateVisibility(
    highlight: Highlight,
    visibility: Highlight["visibility"]
  ) {
    const { error } = await supabase
      .from("story_highlights")
      .update({
        visibility,
        updated_at: new Date().toISOString(),
      })
      .eq("id", highlight.id)
      .eq("user_id", currentUserId);

    if (error) {
      setStatus("Highlight audience could not be updated.");
      return;
    }

    await load();
    setStatus("Highlight audience updated.");
  }

  async function deleteHighlight(highlight: Highlight) {
    if (!window.confirm('Delete "' + highlight.title + '"? Stories remain in your Archive.')) {
      return;
    }

    const { error } = await supabase
      .from("story_highlights")
      .delete()
      .eq("id", highlight.id)
      .eq("user_id", currentUserId);

    if (error) {
      setStatus("Highlight could not be deleted.");
      return;
    }

    if (selectedHighlight === highlight.id) setSelectedHighlight("");
    await load();
    setStatus("Highlight deleted. Your Stories remain archived.");
  }

  function membership(storyId: string) {
    return items.find(
      (item) =>
        item.highlight_id === selectedHighlight &&
        item.story_id === storyId
    );
  }

  async function toggleStory(story: ArchiveStory) {
    const highlight = highlights.find(
      (item) => item.id === selectedHighlight
    );
    if (!highlight) {
      setStatus("Choose or create a Highlight first.");
      return;
    }

    const existing = membership(story.story_id);
    setBusyStory(story.story_id);

    if (existing) {
      const result = await supabase
        .from("story_highlight_items")
        .delete()
        .eq("highlight_id", highlight.id)
        .eq("story_id", story.story_id);

      if (!result.error && highlight.cover_story_id === story.story_id) {
        const remaining = items
          .filter(
            (item) =>
              item.highlight_id === highlight.id &&
              item.story_id !== story.story_id
          )
          .sort((a, b) => a.position - b.position);

        await supabase
          .from("story_highlights")
          .update({
            cover_story_id: remaining[0]?.story_id || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", highlight.id);
      }

      setBusyStory("");
      if (result.error) {
        setStatus("Story could not be removed from the Highlight.");
        return;
      }
    } else {
      const count = items.filter(
        (item) => item.highlight_id === highlight.id
      ).length;

      const result = await supabase
        .from("story_highlight_items")
        .insert({
          highlight_id: highlight.id,
          story_id: story.story_id,
          position: count,
        });

      if (!result.error && !highlight.cover_story_id) {
        await supabase
          .from("story_highlights")
          .update({
            cover_story_id: story.story_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", highlight.id);
      }

      setBusyStory("");
      if (result.error) {
        setStatus("Story could not be added to the Highlight.");
        return;
      }
    }

    await load();
  }

  async function setCover(storyId: string) {
    if (!selectedHighlight || !membership(storyId)) return;

    const { error } = await supabase
      .from("story_highlights")
      .update({
        cover_story_id: storyId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedHighlight)
      .eq("user_id", currentUserId);

    if (error) {
      setStatus("Cover could not be updated.");
      return;
    }

    await load();
    setStatus("Highlight cover updated.");
  }

  const selected = highlights.find(
    (highlight) => highlight.id === selectedHighlight
  );

  return (
    <div className="story-archive-manager">
      <section className="highlight-create-card">
        <div>
          <div className="eyebrow">NEW HIGHLIGHT</div>
          <h2>Keep Stories on your profile</h2>
          <p>
            Highlights use your real Story Archive. Removing a Highlight never deletes the original Story from Archive.
          </p>
        </div>

        <div className="highlight-create-form">
          <input
            value={newTitle}
            maxLength={40}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="Highlight title"
          />
          <select
            value={newVisibility}
            onChange={(event) =>
              setNewVisibility(
                event.target.value as Highlight["visibility"]
              )
            }
          >
            <option value="everyone">Everyone</option>
            <option value="followers">Followers</option>
            <option value="close_friends">Close Friends</option>
          </select>
          <button className="btn" onClick={() => void createHighlight()}>
            Create
          </button>
        </div>
      </section>

      <section className="highlight-manager-list">
        <div className="section-inline-head">
          <div>
            <div className="eyebrow">YOUR HIGHLIGHTS</div>
            <h3>{highlights.length} Highlights</h3>
          </div>
        </div>

        {highlights.length === 0 ? (
          <div className="settings-empty-state">
            <span>A</span>
            <b>No Highlights yet</b>
            <p>Create one above, then choose Stories from your Archive.</p>
          </div>
        ) : (
          <div className="highlight-manager-tabs">
            {highlights.map((highlight) => (
              <div
                key={highlight.id}
                className={
                  "highlight-manager-tab " +
                  (selectedHighlight === highlight.id ? "active" : "")
                }
              >
                <button
                  type="button"
                  onClick={() => setSelectedHighlight(highlight.id)}
                >
                  <b>{highlight.title}</b>
                  <small>
                    {items.filter(
                      (item) => item.highlight_id === highlight.id
                    ).length}{" "}
                    Stories
                  </small>
                </button>
                <div>
                  <button
                    type="button"
                    onClick={() => void renameHighlight(highlight)}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => void deleteHighlight(highlight)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {selected && (
          <label className="highlight-audience-row">
            <span>
              <b>{selected.title}</b>
              <small>Who can see this Highlight</small>
            </span>
            <select
              value={selected.visibility}
              onChange={(event) =>
                void updateVisibility(
                  selected,
                  event.target.value as Highlight["visibility"]
                )
              }
            >
              <option value="everyone">Everyone</option>
              <option value="followers">Followers</option>
              <option value="close_friends">Close Friends</option>
            </select>
          </label>
        )}
      </section>

      <section>
        <div className="section-inline-head">
          <div>
            <div className="eyebrow">STORY ARCHIVE</div>
            <h3>
              {selected
                ? "Choose Stories for " + selected.title
                : "Your archived Stories"}
            </h3>
          </div>
          <span>{archive.length}</span>
        </div>

        {loading ? (
          <p className="settings-status">Loading Story Archive…</p>
        ) : archive.length === 0 ? (
          <div className="settings-empty-state">
            <span>A</span>
            <b>No Stories in Archive</b>
            <p>Your real Stories will appear here after you publish them.</p>
          </div>
        ) : (
          <div className="story-archive-grid">
            {archive.map((story) => {
              const included = Boolean(membership(story.story_id));
              const cover = selected?.cover_story_id === story.story_id;

              return (
                <article
                  key={story.story_id}
                  className={
                    "story-archive-tile " +
                    (included ? "included " : "") +
                    (cover ? "cover" : "")
                  }
                >
                  <button
                    type="button"
                    className="story-archive-media"
                    disabled={busyStory === story.story_id}
                    onClick={() => void toggleStory(story)}
                  >
                    {story.media_type === "video" ? (
                      <video
                        src={mediaUrl(story.media_path)}
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <UserMediaImage
                        src={mediaUrl(story.media_path)}
                        alt={story.caption || "Archived Story"}
                        loading="lazy"
                      />
                    )}
                    <span>{included ? "✓ In Highlight" : "+ Add"}</span>
                  </button>

                  <div>
                    <small>
                      {new Date(story.created_at).toLocaleDateString()}
                    </small>
                    {included && (
                      <button
                        type="button"
                        disabled={cover}
                        onClick={() => void setCover(story.story_id)}
                      >
                        {cover ? "Cover" : "Set cover"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {status && (
        <p className="settings-status" role="status" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  );
}
