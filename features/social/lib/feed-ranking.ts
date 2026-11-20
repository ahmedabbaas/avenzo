import type { Post } from "../types";

export type FeedSortMode = "latest" | "top";

/**
 * Sort only the posts already visible to this viewer. "Top" uses real
 * engagement counts returned by the feed query; it does not fabricate
 * recommendations or expose private engagement data.
 */
export function sortFeedPosts(posts: Post[], mode: FeedSortMode): Post[] {
  return [...posts].sort((left, right) => {
    if (mode === "top") {
      const leftScore = Math.max(0, left.likeCount) * 2 + Math.max(0, left.commentCount) * 3;
      const rightScore = Math.max(0, right.likeCount) * 2 + Math.max(0, right.commentCount) * 3;
      if (leftScore !== rightScore) return rightScore - leftScore;
    }

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
}
