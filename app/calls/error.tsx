"use client";

import Link from "next/link";

export default function CallsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="calls-page">
      <div className="calls-empty" role="alert">
        <b>Calls could not be loaded</b>
        <p>Check your connection and try again. Your call history has not been changed.</p>
        <div className="calls-error-actions">
          <button className="btn" type="button" onClick={reset}>
            Retry
          </button>
          <Link className="btn secondary" href="/messages">
            Messages
          </Link>
        </div>
      </div>
    </main>
  );
}
