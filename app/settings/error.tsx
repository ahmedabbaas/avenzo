"use client";

import Link from "next/link";

export default function SettingsError({ retry }: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <main className="settings-recovery-page">
    <h1>Settings could not load</h1>
    <p role="alert">Check your connection and try again. Your settings have not been changed.</p>
    <div className="settings-recovery-actions">
      <button type="button" className="btn" onClick={retry}>Retry settings</button>
      <Link className="btn secondary" href="/home?screen=profile">Back to profile</Link>
    </div>
  </main>;
}
