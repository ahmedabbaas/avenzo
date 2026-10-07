import Link from "next/link";

export default function SettingsLoading() {
  return <main className="settings-recovery-page">
    <h1>Settings</h1>
    <p role="status">Loading your settings…</p>
    <div className="settings-loading-rows" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => <span key={index} />)}
    </div>
    <Link className="btn secondary" href="/home?screen=profile">Back to profile</Link>
  </main>;
}
