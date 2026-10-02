export default function CallsLoading() {
  return (
    <main className="calls-page" aria-busy="true" aria-label="Loading calls">
      <header className="calls-page-head">
        <div>
          <span>AVENZO DIRECT</span>
          <h1>Calls</h1>
          <p>Loading your call history…</p>
        </div>
      </header>
      <div className="calls-list calls-list-loading" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="call-history-row call-history-skeleton" key={index}>
            <i />
            <span>
              <b />
              <small />
              <em />
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
