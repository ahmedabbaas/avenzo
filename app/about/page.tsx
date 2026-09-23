import Link from "next/link";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <main className="info-shell">
      <section className="info-card">
        <div className="eyebrow">ABOUT AVENZO</div>
        <h1>Social, without the fake crowd.</h1>
        <p>
          AVENZO is being built around real accounts, permanent unique usernames,
          posts, private conversations and a social graph that belongs to actual people.
        </p>
        <div className="info-grid">
          <article><b>Identity first</b><span>One permanent public username per account.</span></article>
          <article><b>Private by design</b><span>Protected account areas and participant-only direct messages.</span></article>
          <article><b>Human-scale discovery</b><span>Find people, follow profiles and build a feed from real activity.</span></article>
        </div>
        <Link className="btn" href="/login">Enter AVENZO</Link>
      </section>
    </main>
  );
}
