import { MessagesSkeleton } from "../../features/social/components/loading-skeletons";

export default function MessagesLoading() {
  return (
    <main className="route-skeleton-shell">
      <MessagesSkeleton />
    </main>
  );
}
