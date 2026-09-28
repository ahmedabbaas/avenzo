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
              Retry the app. Your account session is not intentionally cleared by this screen.
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
