"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="system-page">
          <section className="system-card" role="alert">
            <span className="system-mark" aria-hidden="true">A</span>
            <div className="eyebrow">AVENZO</div>
            <h1>AVENZO hit an unexpected error.</h1>
            <p>
              Your session has not been intentionally cleared. Retry the app, or return
              to the sign-in screen if the problem continues.
            </p>
            <div className="system-actions">
              <button className="btn" onClick={reset}>Try again</button>
              <a className="btn secondary" href="/login">Go to login</a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
