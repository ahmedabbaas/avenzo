import Link from "next/link";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main className="info-shell">
      <section className="info-card">
        <div className="eyebrow">PRIVACY</div>
        <h1>Privacy should be understandable.</h1>
        <p>
          AVENZO uses account information to provide authentication, profiles,
          social connections, posts and conversations. Passwords are handled by
          the authentication provider rather than stored as plain text by the app.
        </p>
        <div className="info-list">
          <p><b>Account data.</b> Email, username, profile details and account identifiers are used to run your account.</p>
          <p><b>Social data.</b> Posts, follows, likes, comments and profile information power the social experience.</p>
          <p><b>Private messages.</b> Direct-message access is restricted to conversation participants through database policies.</p>
          <p><b>Safety data.</b> Reports and blocks may be stored to enforce safety controls.</p>
        </div>
        <p className="info-note">This page describes the current product design and should be reviewed before a public commercial launch.</p>
        <Link className="btn secondary" href="/login">Back to AVENZO</Link>
      </section>
    </main>
  );
}
