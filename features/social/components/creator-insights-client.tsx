"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import Icon from "./icon";

type InsightState = {
  posts: number;
  reels: number;
  followers: number;
  postLikes: number;
  postComments: number;
  postSaves: number;
  postReposts: number;
  reelViews: number;
  reelLikes: number;
  reelComments: number;
  reelSaves: number;
  reelShares: number;
  reelReposts: number;
  published7d: number;
  followers7d: number;
};

const EMPTY: InsightState = {
  posts: 0,
  reels: 0,
  followers: 0,
  postLikes: 0,
  postComments: 0,
  postSaves: 0,
  postReposts: 0,
  reelViews: 0,
  reelLikes: 0,
  reelComments: 0,
  reelSaves: 0,
  reelShares: 0,
  reelReposts: 0,
  published7d: 0,
  followers7d: 0,
};

export default function CreatorInsightsClient({
  userId,
}: {
  userId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<InsightState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

        const [postsResult, reelsResult, followerResult] = await Promise.all([
          supabase
            .from("posts")
            .select("id,created_at")
            .eq("author_id", userId)
            .order("created_at", { ascending: false }),
          supabase
            .from("reels")
            .select("id,created_at,view_count,share_count,save_count")
            .eq("author_id", userId)
            .order("created_at", { ascending: false }),
          supabase
            .from("follows")
            .select("follower_id,created_at")
            .eq("following_id", userId),
        ]);

        if (postsResult.error) throw postsResult.error;
        if (reelsResult.error) throw reelsResult.error;
        if (followerResult.error) throw followerResult.error;

        const posts = postsResult.data || [];
        const reels = reelsResult.data || [];
        const postIds = posts.map((item) => item.id);
        const reelIds = reels.map((item) => item.id);

        const countRows = async (
          table: string,
          column: string,
          ids: string[]
        ) => {
          if (!ids.length) return 0;
          const result = await supabase
            .from(table)
            .select(column, { count: "exact", head: true })
            .in(column, ids);
          if (result.error) throw result.error;
          return result.count || 0;
        };

        const [
          postLikes,
          postComments,
          postSaves,
          postReposts,
          reelLikes,
          reelComments,
          reelReposts,
        ] = await Promise.all([
          countRows("likes", "post_id", postIds),
          countRows("comments", "post_id", postIds),
          countRows("saved_posts", "post_id", postIds),
          countRows("reposts", "post_id", postIds),
          countRows("reel_likes", "reel_id", reelIds),
          countRows("reel_comments", "reel_id", reelIds),
          countRows("reposts", "reel_id", reelIds),
        ]);

        const next: InsightState = {
          posts: posts.length,
          reels: reels.length,
          followers: (followerResult.data || []).length,
          postLikes,
          postComments,
          postSaves,
          postReposts,
          reelViews: reels.reduce(
            (sum, item) => sum + Number(item.view_count || 0),
            0
          ),
          reelLikes,
          reelComments,
          reelSaves: reels.reduce(
            (sum, item) => sum + Number(item.save_count || 0),
            0
          ),
          reelShares: reels.reduce(
            (sum, item) => sum + Number(item.share_count || 0),
            0
          ),
          reelReposts,
          published7d:
            posts.filter((item) => item.created_at >= weekAgo).length +
            reels.filter((item) => item.created_at >= weekAgo).length,
          followers7d: (followerResult.data || []).filter(
            (item) => item.created_at >= weekAgo
          ).length,
        };

        if (!cancelled) setData(next);
      } catch {
        if (!cancelled) setError("Creator Insights could not load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  const totalEngagement =
    data.postLikes +
    data.postComments +
    data.postSaves +
    data.postReposts +
    data.reelLikes +
    data.reelComments +
    data.reelSaves +
    data.reelShares +
    data.reelReposts;

  if (loading) {
    return <div className="insights-loading">Calculating your AVENZO insights…</div>;
  }

  if (error) {
    return <div className="insights-error" role="alert">{error}</div>;
  }

  const cards = [
    ["Content", data.posts + data.reels, "grid"],
    ["Followers", data.followers, "profile"],
    ["Engagement", totalEngagement, "heartModern"],
    ["Clip views", data.reelViews, "eye"],
    ["Published · 7d", data.published7d, "plus"],
    ["New followers · 7d", data.followers7d, "userPlus"],
  ] as const;

  return (
    <div className="creator-insights">
      <section className="insights-score-grid">
        {cards.map(([label, value, icon]) => (
          <article key={label}>
            <Icon name={icon} size={20} />
            <strong>{Number(value).toLocaleString()}</strong>
            <span>{label}</span>
          </article>
        ))}
      </section>

      <section className="insights-breakdown">
        <div>
          <span>POSTS</span>
          <h2>Post engagement</h2>
        </div>
        <div className="insights-metrics">
          <span><b>{data.postLikes.toLocaleString()}</b> Likes</span>
          <span><b>{data.postComments.toLocaleString()}</b> Comments</span>
          <span><b>{data.postSaves.toLocaleString()}</b> Saves</span>
          <span><b>{data.postReposts.toLocaleString()}</b> Reposts</span>
        </div>
      </section>

      <section className="insights-breakdown">
        <div>
          <span>CLIPS</span>
          <h2>Clip performance</h2>
        </div>
        <div className="insights-metrics">
          <span><b>{data.reelViews.toLocaleString()}</b> Views</span>
          <span><b>{data.reelLikes.toLocaleString()}</b> Likes</span>
          <span><b>{data.reelComments.toLocaleString()}</b> Comments</span>
          <span><b>{data.reelSaves.toLocaleString()}</b> Saves</span>
          <span><b>{data.reelShares.toLocaleString()}</b> Shares</span>
          <span><b>{data.reelReposts.toLocaleString()}</b> Reposts</span>
        </div>
      </section>

      <p className="insights-footnote">
        These numbers come from your real AVENZO posts, Clips and follower activity.
      </p>
    </div>
  );
}
