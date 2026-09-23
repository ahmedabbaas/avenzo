import Link from "next/link";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <main className="info-shell">
      <section className="info-card">
        <div className="eyebrow">TERMS</div>
        <h1>Use AVENZO responsibly.</h1>
        <p>
          By using AVENZO, users are expected to keep account information accurate,
          respect other people, follow applicable law and avoid abusing platform
          features or attempting to bypass security controls.
        </p>
        <div className="info-list">
          <p><b>Your account.</b> You are responsible for activity performed through your account.</p>
          <p><b>Your content.</b> Do not upload content you do not have the right to share.</p>
          <p><b>Platform safety.</b> AVENZO may restrict abusive behavior to protect users and the service.</p>
          <p><b>Service changes.</b> Features may evolve as AVENZO develops.</p>
        </div>
        <p className="info-note">This is a product draft, not a substitute for jurisdiction-specific legal review before launch.</p>
        <Link className="btn secondary" href="/login">Back to AVENZO</Link>
      </section>
    </main>
  );
}
