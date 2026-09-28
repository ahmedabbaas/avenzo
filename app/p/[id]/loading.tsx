import FeedSkeleton from "../../../features/social/components/feed-skeleton";
import { CommentsSkeleton } from "../../../features/social/components/loading-skeletons";

export default function PostLoading() {
  return (
    <main className="post-route-skeleton route-skeleton-shell">
      <FeedSkeleton />
      <CommentsSkeleton />
    </main>
  );
}
