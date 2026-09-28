export function NotificationSkeleton() {
  return (
    <div className="notification-skeleton-list" aria-label="Loading notifications">
      {Array.from({ length: 7 }, (_, index) => (
        <div className="notification-skeleton-row" key={index}>
          <i />
          <span>
            <b />
            <em />
          </span>
          <strong />
        </div>
      ))}
    </div>
  );
}

export function MessagesSkeleton() {
  return (
    <div className="messages-skeleton-list" aria-label="Loading messages">
      {Array.from({ length: 7 }, (_, index) => (
        <div className="messages-skeleton-row" key={index}>
          <i />
          <span>
            <b />
            <em />
          </span>
          <small />
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <main className="profile-route-skeleton" aria-label="Loading profile">
      <div className="profile-skeleton-head">
        <i />
        <section>
          <b />
          <span />
          <span />
        </section>
      </div>
      <div className="profile-skeleton-stats">
        <i /><i /><i />
      </div>
      <div className="profile-skeleton-tabs">
        <i /><i /><i />
      </div>
      <div className="profile-skeleton-grid">
        {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
      </div>
    </main>
  );
}

export function CommentsSkeleton() {
  return (
    <div className="comments-skeleton" aria-label="Loading comments">
      {Array.from({ length: 4 }, (_, index) => (
        <div className="comment-skeleton-row" key={index}>
          <i />
          <span>
            <b />
            <em />
          </span>
        </div>
      ))}
    </div>
  );
}

export function ReelsSkeleton() {
  return (
    <main className="reels-skeleton" aria-label="Loading reels">
      <header><i /><span /></header>
      <div className="reels-skeleton-frame">
        <i />
        <section>
          <b />
          <span />
          <span />
        </section>
      </div>
    </main>
  );
}

export function SearchSkeleton() {
  return (
    <div className="search-route-skeleton" aria-label="Loading search">
      <div className="search-skeleton-input" />
      <div className="search-skeleton-people">
        {Array.from({ length: 4 }, (_, index) => <i key={index} />)}
      </div>
      <div className="search-skeleton-grid">
        {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
      </div>
    </div>
  );
}
