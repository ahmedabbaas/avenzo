"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";
import UserMediaImage from "./user-media-image";
import VerifiedBadge from "./verified-badge";

type TaggedPost = {
  id: string;
  author_id: string;
  caption: string;
  media_path: string | null;
  media_width: number | null;
  media_height: number | null;
  created_at: string;
  authorUsername: string;
  authorName: string;
  authorVerified: boolean;
};

export default function TaggedPostsGrid({
  username,
}: {
  username: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [posts, setPosts] = useState<TaggedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const mediaUrl = useCallback(
    (path: string) =>
      supabase.storage.from("media").getPublicUrl(path).data.publicUrl,
    [supabase]
  );

  const load = useCallback(async () => {
    setLoading(true);

    const result = await supabase
      .from("posts")
      .select("id,author_id,caption,media_path,media_width,media_height,created_at")
      .contains("mentions", [username.toLowerCase()])
      .order("created_at", { ascending: false })
      .limit(120);

    if (result.error) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const rows = result.data || [];
    const authorIds = [...new Set(rows.map((post) => post.author_id))];
    const profilesResult = authorIds.length
      ? await supabase
          .from("profiles")
          .select("id,username,display_name,verified")
          .in("id", authorIds)
      : { data: [], error: null };

    const authorMap = new Map(
      (profilesResult.data || []).map((profile) => [profile.id, profile])
    );

    setPosts(
      rows.map((post) => {
        const author = authorMap.get(post.author_id);
        return {
          ...post,
          authorUsername: author?.username || "user",
          authorName: author?.display_name || "AVENZO user",
          authorVerified: Boolean(author?.verified),
        };
      })
    );
    setLoading(false);
  }, [supabase, username]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading) {
    return (
      <div className="tagged-posts-empty">
        <b>Loading tagged posts…</b>
      </div>
    );
  }

  if (!posts.length) {
    return (
      <div className="tagged-posts-empty">
        <b>No tagged posts yet.</b>
        <p>
          Real posts that mention @{username} in their tag list will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="tagged-posts-grid">
      {posts.map((post) => (
        <article key={post.id} className="tagged-post-tile">
          <Link href={"/p/" + encodeURIComponent(post.id)}>
            {post.media_path ? (
              <UserMediaImage
                src={mediaUrl(post.media_path)}
                alt={post.caption || "Tagged AVENZO post"}
                width={post.media_width}
                height={post.media_height}
                loading="lazy"
              />
            ) : (
              <span>{post.caption || "Tagged post"}</span>
            )}
          </Link>
          <div className="tagged-post-author">
            <span>
              by <b>@{post.authorUsername}</b>
              <VerifiedBadge verified={post.authorVerified} />
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
