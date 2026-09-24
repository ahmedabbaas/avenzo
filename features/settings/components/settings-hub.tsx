"use client";

import Link from "next/link";
import Icon from "../../social/components/icon";

function SettingsCard({
  href,
  icon,
  title,
  text,
}: {
  href: string;
  icon: "settings" | "profile" | "messages" | "activity";
  title: string;
  text: string;
}) {
  return (
    <Link className="settings-hub-card" href={href}>
      <span className="settings-hub-icon">
        <Icon name={icon} size={21} />
      </span>
      <span className="settings-hub-copy">
        <b>{title}</b>
        <small>{text}</small>
      </span>
      <span className="settings-arrow">›</span>
    </Link>
  );
}

export default function SettingsHub() {
  return (
    <div className="settings-hub">
      <section>
        <div className="settings-group-label">APP</div>
        <SettingsCard
          href="/settings/app"
          icon="settings"
          title="App Settings"
          text="Appearance, language, notifications, feed, media and accessibility."
        />
      </section>

      <section>
        <div className="settings-group-label">ACCOUNT</div>
        <SettingsCard
          href="/settings/account"
          icon="profile"
          title="Profile & Account"
          text="Profile, username, security, privacy and account information."
        />
        <SettingsCard
          href="/settings/blocked"
          icon="activity"
          title="Blocked Accounts"
          text="View and unblock accounts you have blocked."
        />
      </section>

      <section>
        <div className="settings-group-label">OTHER</div>
        <SettingsCard
          href="/help"
          icon="messages"
          title="Help & Support"
          text="Get help with your account and AVENZO features."
        />
        <SettingsCard
          href="/about"
          icon="activity"
          title="About"
          text="Learn about AVENZO."
        />
        <SettingsCard
          href="/terms"
          icon="activity"
          title="Terms"
          text="Read the AVENZO terms."
        />
        <SettingsCard
          href="/privacy"
          icon="activity"
          title="Privacy Policy"
          text="Understand how AVENZO handles your data."
        />
      </section>
    </div>
  );
}
