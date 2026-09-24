import Link from "next/link";

export const metadata = { title: "Help & Support" };

export default function HelpPage() {
  return (
    <main className="info-shell">
      <section className="info-card">
        <div className="eyebrow">HELP & SUPPORT</div>
        <h1>Help with AVENZO.</h1>
        <p>
          Use Settings for account, privacy and app preferences. For account access,
          password recovery is available from the login screen.
        </p>
        <div className="info-list">
          <p><b>Can’t sign in?</b> Use Forgot Password from the login page.</p>
          <p><b>Privacy concern?</b> Open Profile & Account → Privacy or Blocked Accounts.</p>
          <p><b>App preference?</b> Open App Settings for theme, language, media and notifications.</p>
        </div>
        <Link className="btn" href="/settings">Back to Settings</Link>
      </section>
    </main>
  );
}
