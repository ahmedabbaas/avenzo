"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import UserMediaImage from "./user-media-image";
import Icon from "./icon";

type SavedEntry = {
  id: string;
  type: "post" | "reel";
  caption: string;
  mediaPath: string | null;
  coverPath: string | null;
  mediaType: "image" | "video";
  savedAt: string;
};

export default function ProfileSavedGrid({
  userId,
}: {
  userId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<SavedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const mediaUrl = useCallback(
    (path: string) =>
      supabase.storage.from("media").getPublicUrl(path).data.publicUrl,
    [supabase]
  );

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      const [savedPosts, savedReels] = await Promise.all([
        supabase
          .from("saved_posts")
          .select("post_id,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("saved_reels")
          .select("reel_id,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      if (savedPosts.error || savedReels.error) {
        if (active) {
          setError("Saved content could not be loaded.");
          setLoading(false);
        }
        return;
      }

      const postRows = savedPosts.data || [];
      const reelRows = savedReels.data || [];
      const postIds = postRows.map((row) => row.post_id);
      const reelIds = reelRows.map((row) => row.reel_id);

      const [postsResult, reelsResult] = await Promise.all([
        postIds.length
          ? supabase
              .from("posts")
              .select("id,caption,media_path,cover_path,media_type,created_at")
              .in("id", postIds)
          : Promise.resolve({ data: [], error: null }),
        reelIds.length
          ? supabase
              .from("reels")
              .select("id,caption,media_path,cover_path,created_at")
              .in("id", reelIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (postsResult.error || reelsResult.error) {
        if (active) {
          setError("Some saved media could not be loaded.");
          setLoading(false);
        }
        return;
      }

      const postSavedAt = new Map(
        postRows.map((row) => [row.post_id, row.created_at])
      );
      const reelSavedAt = new Map(
        reelRows.map((row) => [row.reel_id, row.created_at])
      );

      const nextEntries: SavedEntry[] = [
        ...(postsResult.data || []).map((post) => ({
          id: post.id,
          type: "post" as const,
          caption: post.caption || "",
          mediaPath: post.media_path,
          coverPath: post.cover_path,
          mediaType:
            post.media_type === "video" ? ("video" as const) : ("image" as const),
          savedAt: postSavedAt.get(post.id) || post.created_at,
        })),
        ...(reelsResult.data || []).map((reel) => ({
          id: reel.id,
          type: "reel" as const,
          caption: reel.caption || "",
          mediaPath: reel.media_path,
          coverPath: reel.cover_path,
          mediaType: "video" as const,
          savedAt: reelSavedAt.get(reel.id) || reel.created_at,
        })),
      ].sort(
        (a, b) =>
          new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      );

      if (active) {
        setEntries(nextEntries);
        setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [supabase, userId]);

  if (loading) {
    return (
      <div className="profile-saved-grid profile-saved-loading" aria-label="Loading saved content">
        {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-saved-empty" role="status">
        <b>Saved content unavailable</b>
        <span>{error}</span>
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="profile-saved-empty">
        <Icon name="saved" size={26} />
        <b>No saved content yet</b>
        <span>Posts and Reels you save will appear here privately.</span>
      </div>
    );
  }

  return (
    <div className="profile-saved-grid">
      {entries.map((entry) => {
        const previewPath = entry.coverPath || entry.mediaPath;
        const href =
          entry.type === "post"
            ? "/p/" + encodeURIComponent(entry.id)
            : "/reels?reel=" + encodeURIComponent(entry.id);

        return (
          <Link
            key={entry.type + ":" + entry.id}
            className="profile-saved-tile"
            href={href}
          >
            {previewPath ? (
              entry.mediaType === "video" && !entry.coverPath ? (
                <video
                  src={mediaUrl(previewPath)}
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <UserMediaImage
                  src={mediaUrl(previewPath)}
                  alt={entry.caption || "Saved AVENZO content"}
                  loading="lazy"
                />
              )
            ) : (
              <span className="profile-saved-text">
                {entry.caption || "Saved content"}
              </span>
            )}
            {entry.type === "reel" && (
              <span className="profile-saved-kind" aria-hidden="true">
                <Icon name="reels" size={16} />
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
