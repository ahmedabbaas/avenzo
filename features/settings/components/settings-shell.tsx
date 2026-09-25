"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "../../social/components/icon";
import type { ReactNode } from "react";
import { useUiTranslation } from "../lib/i18n";

const NAV = [
  { href: "/settings", label: "Settings home", icon: "settings" as const },
  { href: "/settings/app", label: "App Settings", icon: "explore" as const },
  { href: "/settings/account", label: "Profile & Account", icon: "profile" as const },
  { href: "/settings/follow-requests", label: "Follow Requests", icon: "activity" as const },
  { href: "/settings/close-friends", label: "Close Friends", icon: "profile" as const },
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
  const t = useUiTranslation();

  return (
    <main className="settings-page-shell">
      <aside className="settings-sidebar">
        <Link className="settings-back-home" href="/home?screen=profile">
          <Icon name="back" size={17} />
          {t("Back to AVENZO")}
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
              <span>{t(item.label)}</span>
              <span className="settings-arrow">›</span>
            </Link>
          ))}
        </nav>

        <div className="settings-sidebar-links">
          <Link href="/about">{t("About")}</Link>
          <Link href="/terms">{t("Terms")}</Link>
          <Link href="/privacy">{t("Privacy")}</Link>
        </div>
      </aside>

      <section className="settings-content">
        <div className="settings-mobile-head">
          <Link
            href={pathname === "/settings" ? "/home?screen=profile" : "/settings"}
            aria-label={pathname === "/settings" ? "Back to AVENZO" : "Back to settings"}
          >
            <Icon name="back" size={18} />
          </Link>
          <b>{t("Settings")}</b>
        </div>

        <header className="settings-page-header">
          <div className="eyebrow">{eyebrow}</div>
          <h1>{t(title)}</h1>
          <p>{description}</p>
        </header>

        {children}
      </section>
    </main>
  );
}
