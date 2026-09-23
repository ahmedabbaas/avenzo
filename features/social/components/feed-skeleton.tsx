export default function FeedSkeleton() {
  return (
    <div className="feed-skeleton" aria-label="Loading feed">
      {[0, 1].map((item) => (
        <div className="skeleton-card" key={item}>
          <div className="skeleton-head">
            <i />
            <span />
          </div>
          <div className="skeleton-media" />
          <div className="skeleton-lines">
            <i />
            <i />
          </div>
        </div>
      ))}
    </div>
  );
}

