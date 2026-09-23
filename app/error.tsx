"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="system-page">
      <div className="system-card">
        <span className="system-mark">A</span>
        <div className="eyebrow">AVENZO</div>
        <h1>Something went wrong.</h1>
        <p>
          The page hit an unexpected error. Your account session has not been
          intentionally cleared.
        </p>
        <div className="system-actions">
          <button className="btn" onClick={reset}>
            Try again
          </button>
          <a className="btn secondary" href="/login">
            Go to login
          </a>
        </div>
      </div>
    </main>
  );
}
