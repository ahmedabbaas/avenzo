"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "../../social/components/icon";
import type { ReactNode } from "react";

const NAV = [
  { href: "/settings", label: "Settings home", icon: "settings" as const },
  { href: "/settings/app", label: "App Settings", icon: "explore" as const },
  { href: "/settings/account", label: "Profile & Account", icon: "profile" as const },
  { href: "/settings/blocked", label: "Blocked Accounts", icon: "saved" as const },
];

export default function SettingsShell({
  title,
  eyebrow,
  description,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <main className="settings-page-shell">
      <aside className="settings-sidebar">
        <Link className="settings-back-home" href="/home?screen=profile">
          <Icon name="back" size={17} />
          Back to AVENZO
        </Link>

        <div className="settings-sidebar-brand">
          <span className="brand-mark">A</span>
          <div>
            <b>AVENZO</b>
            <small>Settings</small>
          </div>
        </div>

        <nav aria-label="Settings navigation">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                pathname === item.href ||
                (item.href !== "/settings" && pathname.startsWith(item.href))
                  ? "active"
                  : ""
              }
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
              <span className="settings-arrow">›</span>
            </Link>
          ))}
        </nav>

        <div className="settings-sidebar-links">
          <Link href="/about">About</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </aside>

      <section className="settings-content">
        <div className="settings-mobile-head">
          <Link href="/settings" aria-label="Back to settings">
            <Icon name="back" size={18} />
          </Link>
          <b>Settings</b>
        </div>

        <header className="settings-page-header">
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>

        {children}
      </section>
    </main>
  );
}
