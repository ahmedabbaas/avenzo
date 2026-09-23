import Link from "next/link";

export default function NotFound() {
  return (
    <main className="system-page">
      <div className="system-card">
        <span className="system-mark">A</span>
        <div className="eyebrow">404</div>
        <h1>This page isn’t on AVENZO.</h1>
        <p>The link may be outdated, private, or simply never existed.</p>
        <Link className="btn" href="/">
          Back to AVENZO
        </Link>
      </div>
    </main>
  );
}
