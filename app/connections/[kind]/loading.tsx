export default function ConnectionsLoading() {
  return (
    <main className="connections-shell route-skeleton-shell" aria-label="Loading connections">
      <div className="connections-route-skeleton">
        <div className="connection-skeleton-heading"><i /><span><b /><em /></span></div>
        {Array.from({ length: 7 }, (_, index) => (
          <div className="connection-row connection-skeleton" key={index}>
            <i /><div><b /><span /></div><em />
          </div>
        ))}
      </div>
    </main>
  );
}
