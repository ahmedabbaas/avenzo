"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon, { type IconName } from "../../social/components/icon";
import AvatarImage from "../../social/components/avatar-image";
import VerifiedBadge from "../../social/components/verified-badge";
import { avatarFor } from "../../social/lib/profile";
import type { Profile } from "../../social/types";
import MobileBottomNav from "../../../components/mobile-bottom-nav";
import { createClient } from "../../../lib/supabase/client";
import { useUiTranslation } from "../lib/i18n";
import { applyAppPreferences } from "../lib/apply-preferences";
import type { AppSettings, ThemePreference } from "../types";

function SettingsCard({
  href,
  icon,
  title,
  text,
}: {
  href: string;
  icon: IconName;
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

type MobileSettingRow = {
  id: string;
  href: string;
  icon: IconName;
  title: string;
  text: string;
};

export default function SettingsHub({
  profile,
  initialSettings,
}: {
  profile?: Profile;
  initialSettings?: AppSettings;
}) {
  const t = useUiTranslation();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [search, setSearch] = useState("");
  const [mobileSettings, setMobileSettings] = useState(initialSettings);
  const [themeStatus, setThemeStatus] = useState("");

  const rows: MobileSettingRow[] = [
    {
      id: "account",
      href: "/settings/account",
      icon: "profile",
      title: "Account",
      text: "Profile, security, personal information",
    },
    {
      id: "privacy",
      href: "/settings/account#privacy",
      icon: "shield",
      title: "Privacy",
      text: "Account privacy, blocked accounts, activity",
    },
    {
      id: "notifications",
      href: "/settings/app#notifications",
      icon: "bellModern",
      title: "Notifications",
      text: "Likes, comments, follows, messages and more",
    },
    {
      id: "language",
      href: "/settings/app#language",
      icon: "globe",
      title: "Language",
      text: "App language and regional settings",
    },
    {
      id: "media",
      href: "/settings/app#media",
      icon: "reels",
      title: "Media & Storage",
      text: "Auto-play, video quality, data usage",
    },
    {
      id: "feed",
      href: "/settings/app#feed",
      icon: "sliders",
      title: "Feed Preferences",
      text: "Content, suggestions, sensitive content",
    },
    {
      id: "blocked",
      href: "/settings/blocked",
      icon: "profile",
      title: "Blocked Accounts",
      text: "Manage blocked users",
    },
    {
      id: "help",
      href: "/help",
      icon: "messages",
      title: "Help & Support",
      text: "Help center, contact us, report a problem",
    },
    {
      id: "about",
      href: "/about",
      icon: "info",
      title: "About Avenzo",
      text: "Version, terms, privacy policy",
    },
  ];

  const normalized = search.trim().toLowerCase();
  const visibleRows = normalized
    ? rows.filter((row) =>
        (row.title + " " + row.text).toLowerCase().includes(normalized)
      )
    : rows;
  const appearanceMatches =
    !normalized ||
    "appearance light dark system theme color".includes(normalized);

  async function changeTheme(theme: ThemePreference) {
    if (!mobileSettings || mobileSettings.theme === theme) return;

    const previous = mobileSettings;
    const next = { ...mobileSettings, theme };
    setMobileSettings(next);
    setThemeStatus("");
    applyAppPreferences(next);

    const { error } = await supabase
      .from("app_settings")
      .update({ theme })
      .eq("user_id", next.user_id);

    if (error) {
      setMobileSettings(previous);
      applyAppPreferences(previous);
      setThemeStatus("Could not save theme.");
      return;
    }

    setThemeStatus("Theme saved.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <div className="settings-mobile-reference" style={{ display: "none" }}>
        {profile && (
          <Link className="settings-mobile-profile-card" href="/settings/account">
            <AvatarImage
              src={avatarFor(profile)}
              alt={profile.display_name}
              size={108}
            />
            <span>
              <b className="verified-line">
                {profile.display_name}
                <VerifiedBadge verified={profile.verified} />
              </b>
              <small>@{profile.username}</small>
              {profile.bio && <em>{profile.bio}</em>}
            </span>
            <i aria-hidden="true">›</i>
          </Link>
        )}

        <label className="settings-mobile-search">
          <Icon name="search" size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value.slice(0, 80))}
            placeholder="Search settings..."
            aria-label="Search settings"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear settings search"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </label>

        <div className="settings-mobile-list">
          {visibleRows.slice(0, 3).map((row) => (
            <Link key={row.id} href={row.href} className="settings-mobile-row">
              <span className="settings-mobile-row-icon">
                <Icon name={row.icon} size={21} />
              </span>
              <span>
                <b>{row.title}</b>
                <small>{row.text}</small>
              </span>
              <i>›</i>
            </Link>
          ))}

          {appearanceMatches && mobileSettings && (
            <div className="settings-mobile-row settings-mobile-appearance">
              <span className="settings-mobile-row-icon">
                <Icon name="palette" size={21} />
              </span>
              <span>
                <b>Appearance</b>
                <small>Light mode, dark mode, theme color</small>
              </span>
              <div className="settings-theme-segment" role="group" aria-label="Appearance">
                {(["light", "dark", "system"] as const).map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    className={mobileSettings.theme === theme ? "active" : ""}
                    onClick={() => void changeTheme(theme)}
                  >
                    {theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {visibleRows.slice(3).map((row) => (
            <Link key={row.id} href={row.href} className="settings-mobile-row">
              <span className="settings-mobile-row-icon">
                <Icon name={row.icon} size={21} />
              </span>
              <span>
                <b>{row.title}</b>
                <small>{row.text}</small>
              </span>
              <i>›</i>
            </Link>
          ))}

          {normalized && visibleRows.length === 0 && !appearanceMatches && (
            <div className="settings-mobile-empty">
              <Icon name="search" size={24} />
              <b>No settings found</b>
              <small>Try another setting name.</small>
            </div>
          )}
        </div>

        {themeStatus && (
          <div className="settings-mobile-status" role="status">
            {themeStatus}
          </div>
        )}

        {!normalized && (
          <button
            type="button"
            className="settings-mobile-logout"
            onClick={() => void signOut()}
          >
            <Icon name="logout" size={21} />
            <span>Log Out</span>
            <i>›</i>
          </button>
        )}
      </div>

      <div className="settings-desktop-hub">
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
      </div>

      {profile && (
        <MobileBottomNav
          active={null}
          onHome={() => router.push("/home?screen=home")}
          onSearch={() => router.push("/home?screen=explore")}
          onCreate={() => router.push("/home?screen=home&create=post")}
          onReels={() => router.push("/reels")}
          onProfile={() => router.push("/home?screen=profile")}
          profileAvatarUrl={avatarFor(profile)}
        />
      )}
    </>
  );
}
