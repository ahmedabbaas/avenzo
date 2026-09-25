"use client";

import Link from "next/link";
import Icon from "../../social/components/icon";
import { useUiTranslation } from "../lib/i18n";

function SettingsCard({
  href,
  icon,
  title,
  text,
}: {
  href: string;
  icon: "settings" | "profile" | "messages" | "activity" | "saved";
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
  const t = useUiTranslation();

  return (
    <div className="settings-hub">
      <section>
        <div className="settings-group-label">{t("App").toUpperCase()}</div>
        <SettingsCard
          href="/settings/app"
          icon="settings"
          title={t("App Settings")}
          text="Appearance, language, notifications, feed, media and accessibility."
        />
      </section>

      <section>
        <div className="settings-group-label">{t("Account").toUpperCase()}</div>
        <SettingsCard
          href="/settings/account"
          icon="profile"
          title={t("Profile & Account")}
          text="Profile, username, security, privacy and account information."
        />
        <SettingsCard
          href="/settings/follow-requests"
          icon="activity"
          title="Follow Requests"
          text="Review pending requests for your private account."
        />
        <SettingsCard
          href="/settings/close-friends"
          icon="profile"
          title="Close Friends"
          text="Manage your private audience for Notes, Stories and private sharing."
        />
        <SettingsCard
          href="/settings/archive"
          icon="saved"
          title="Story Archive & Highlights"
          text="Manage archived Stories and keep selected moments on your profile."
        />
        <SettingsCard
          href="/settings/blocked"
          icon="activity"
          title={t("Blocked Accounts")}
          text="View and unblock accounts you have blocked."
        />
      </section>

      <section>
        <div className="settings-group-label">{t("Other").toUpperCase()}</div>
        <SettingsCard
          href="/help"
          icon="messages"
          title={t("Help & Support")}
          text="Get help with your account and AVENZO features."
        />
        <SettingsCard
          href="/about"
          icon="activity"
          title={t("About")}
          text="Learn about AVENZO."
        />
        <SettingsCard
          href="/terms"
          icon="activity"
          title={t("Terms")}
          text="Read the AVENZO terms."
        />
        <SettingsCard
          href="/privacy"
          icon="activity"
          title={t("Privacy Policy")}
          text="Understand how AVENZO handles your data."
        />
      </section>
    </div>
  );
}
