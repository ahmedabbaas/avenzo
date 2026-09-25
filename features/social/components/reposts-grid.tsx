"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";
import UserMediaImage from "./user-media-image";
import VerifiedBadge from "./verified-badge";

type RepostRow = {
  id: string;
  post_id: string | null;
  reel_id: string | null;
  note: string;
  created_at: string;
};

type RepostItem = {
  repostId: string;
  type: "post" | "reel";
  contentId: string;
  mediaPath: string | null;
  coverPath: string | null;
  caption: string;
  authorId: string;
  authorUsername: string;
  authorName: string;
  authorVerified: boolean;
  createdAt: string;
};

export default function RepostsGrid({
  profileId,
  own = false,
}: {
  profileId: string;
  own?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<RepostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  const mediaUrl = useCallback(
    (path: string) =>
      supabase.storage.from("media").getPublicUrl(path).data.publicUrl,
    [supabase]
  );

  const load = useCallback(async () => {
    setLoading(true);

    const { data: repostRows, error } = await supabase
      .from("reposts")
      .select("id,post_id,reel_id,note,created_at")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(120);

    if (error) {
      setItems([]);
      setLoading(false);
      return;
    }

    const reposts = (repostRows || []) as RepostRow[];
    const postIds = reposts.flatMap((item) =>
      item.post_id ? [item.post_id] : []
    );
    const reelIds = reposts.flatMap((item) =>
      item.reel_id ? [item.reel_id] : []
    );

    const [postsResult, reelsResult] = await Promise.all([
      postIds.length
        ? supabase
            .from("posts")
            .select("id,author_id,caption,media_path,cover_path")
            .in("id", postIds)
        : Promise.resolve({ data: [], error: null }),
      reelIds.length
        ? supabase
            .from("reels")
            .select("id,author_id,caption,media_path,cover_path")
            .in("id", reelIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (postsResult.error || reelsResult.error) {
      setItems([]);
      setLoading(false);
      return;
    }

    const contentRows = [
      ...(postsResult.data || []).map((row) => ({
        ...row,
        type: "post" as const,
      })),
      ...(reelsResult.data || []).map((row) => ({
        ...row,
        type: "reel" as const,
      })),
    ];

    const authorIds = [...new Set(contentRows.map((row) => row.author_id))];
    const profilesResult = authorIds.length
      ? await supabase
          .from("profiles")
          .select("id,username,display_name,verified")
          .in("id", authorIds)
      : { data: [], error: null };

    const authorMap = new Map(
      (profilesResult.data || []).map((profile) => [profile.id, profile])
    );
    const postMap = new Map(
      (postsResult.data || []).map((row) => [row.id, row])
    );
    const reelMap = new Map(
      (reelsResult.data || []).map((row) => [row.id, row])
    );

    const next = reposts.flatMap((repost): RepostItem[] => {
      const type = repost.post_id ? "post" : "reel";
      const contentId = repost.post_id || repost.reel_id || "";
      const content =
        type === "post" ? postMap.get(contentId) : reelMap.get(contentId);

      if (!content) return [];

      const author = authorMap.get(content.author_id);

      return [{
        repostId: repost.id,
        type,
        contentId,
        mediaPath: content.media_path || null,
        coverPath: content.cover_path || null,
        caption: content.caption || "",
        authorId: content.author_id,
        authorUsername: author?.username || "user",
        authorName: author?.display_name || "AVENZO user",
        authorVerified: Boolean(author?.verified),
        createdAt: repost.created_at,
      }];
    });

    setItems(next);
    setLoading(false);
  }, [profileId, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function removeRepost(item: RepostItem) {
    setBusyId(item.repostId);
    const { error } = await supabase
      .from("reposts")
      .delete()
      .eq("id", item.repostId)
      .eq("user_id", profileId);
    setBusyId("");

    if (!error) {
      setItems((current) =>
        current.filter((entry) => entry.repostId !== item.repostId)
      );
    }
  }

  if (loading) {
    return (
      <div className="reposts-empty">
        <b>Loading reposts…</b>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="reposts-empty">
        <b>No reposts yet.</b>
        <p>Posts and Reels you repost will appear here without duplicating the original media.</p>
      </div>
    );
  }

  return (
    <div className="reposts-grid">
      {items.map((item) => {
        const preview = item.coverPath || item.mediaPath;
        return (
          <article className="repost-tile" key={item.repostId}>
            <Link
              className="repost-preview"
              href={
                item.type === "post"
                  ? "/p/" + encodeURIComponent(item.contentId)
                  : "/r/" + encodeURIComponent(item.contentId)
              }
            >
              {preview ? (
                <UserMediaImage
                  src={mediaUrl(preview)}
                  alt={item.caption || "Reposted AVENZO content"}
                  loading="lazy"
                />
              ) : (
                <span className="repost-text-preview">
                  {item.caption || "AVENZO post"}
                </span>
              )}
              <i>{item.type === "reel" ? "REEL" : "POST"}</i>
            </Link>

            <div className="repost-attribution">
              <span>
                Original by <b>@{item.authorUsername}</b>
                <VerifiedBadge verified={item.authorVerified} />
              </span>
              {own && (
                <button
                  type="button"
                  disabled={busyId === item.repostId}
                  onClick={() => void removeRepost(item)}
                >
                  Undo
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
