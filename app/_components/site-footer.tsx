"use client";

import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="AVENZO information">
      <nav>
        <Link href="/about">About</Link>
        <Link href="/community-guidelines">Community Guidelines</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </nav>
      <small>© {new Date().getFullYear()} AVENZO</small>
    </footer>
  );
}
