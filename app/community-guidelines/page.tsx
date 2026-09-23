import Link from "next/link";

export const metadata = { title: "Community Guidelines" };

export default function CommunityGuidelinesPage() {
  return (
    <main className="info-shell">
      <section className="info-card">
        <div className="eyebrow">COMMUNITY GUIDELINES</div>
        <h1>Make AVENZO worth opening.</h1>
        <p>
          AVENZO is designed for real people and real conversations. Accounts should
          not be used for harassment, impersonation, spam, threats, hateful conduct,
          sexual exploitation or coordinated abuse.
        </p>
        <div className="info-list">
          <p><b>Be real.</b> Do not impersonate another person or misrepresent ownership of an identity.</p>
          <p><b>Respect people.</b> Harassment, targeted abuse and threats are not welcome.</p>
          <p><b>Do not spam.</b> Automated or deceptive engagement damages the network for everyone.</p>
          <p><b>Use safety tools.</b> Block and report controls exist so users can protect their experience.</p>
        </div>
        <Link className="btn secondary" href="/login">Back to AVENZO</Link>
      </section>
    </main>
  );
}
