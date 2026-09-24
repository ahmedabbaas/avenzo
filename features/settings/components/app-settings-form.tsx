"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { applyAppPreferences } from "../lib/apply-preferences";
import type { AppSettings } from "../types";
import { useUiTranslation } from "../lib/i18n";

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="settings-toggle-row">
      <span>
        <b>{label}</b>
        {description && <small>{description}</small>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="settings-switch" aria-hidden="true" />
    </label>
  );
}

function Section({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <section className="settings-form-section">
      <div className="settings-form-head">
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <div className="settings-form-body">{children}</div>
    </section>
  );
}

export default function AppSettingsForm({
  initialSettings,
}: {
  initialSettings: AppSettings;
}) {
  const supabase = useMemo(() => createClient(), []);
  const t = useUiTranslation();
  const [settings, setSettings] = useState(initialSettings);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    applyAppPreferences(settings);
  }, [settings]);

  async function persist(next = settings, quiet = false) {
    setSaving(true);
    if (!quiet) setStatus("");

    const { error } = await supabase
      .from("app_settings")
      .update({
        theme: next.theme,
        language: next.language,
        notify_likes: next.notify_likes,
        notify_comments: next.notify_comments,
        notify_followers: next.notify_followers,
        notify_messages: next.notify_messages,
        notify_mentions: next.notify_mentions,
        notify_stories: next.notify_stories,
        notify_reels: next.notify_reels,
        notify_other: next.notify_other,
        show_suggested_posts: next.show_suggested_posts,
        feed_autoplay_videos: next.feed_autoplay_videos,
        show_sensitive_content: next.show_sensitive_content,
        data_saving_mode: next.data_saving_mode,
        media_autoplay_videos: next.media_autoplay_videos,
        high_quality_uploads: next.high_quality_uploads,
        use_less_mobile_data: next.use_less_mobile_data,
        reduce_animations: next.reduce_animations,
        larger_text: next.larger_text,
        high_contrast: next.high_contrast,
        confirm_delete_content: next.confirm_delete_content,
        confirm_unfollow: next.confirm_unfollow,
        auto_save_settings: next.auto_save_settings,
      })
      .eq("user_id", next.user_id);

    setSaving(false);

    if (error) {
      setStatus("Could not save app settings.");
      return;
    }

    if (!quiet) setStatus("App settings saved.");
  }

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }

    if (!settings.auto_save_settings) return;

    const timer = window.setTimeout(() => {
      void persist(settings, true);
    }, 450);

    return () => window.clearTimeout(timer);
    // persist is intentionally not a dependency; this effect saves snapshots of settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  function patch<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="settings-sections">
      <Section
        title={t("Appearance")}
        text="Choose how AVENZO looks on this device."
      >
        <div className="theme-options">
          {(["light", "dark", "system"] as const).map((theme) => (
            <button
              type="button"
              key={theme}
              className={"theme-choice " + (settings.theme === theme ? "active" : "")}
              onClick={() => patch("theme", theme)}
            >
              <span className={"theme-preview " + theme}>
                <i />
                <b />
                <em />
              </span>
              <strong>
                {theme === "light"
                  ? t("Light Mode")
                  : theme === "dark"
                    ? t("Dark Mode")
                    : t("System Default")}
              </strong>
            </button>
          ))}
        </div>
      </Section>

      <Section
        title={t("Language")}
        text="Choose the language used by AVENZO."
      >
        <label className="settings-field">
          <span>{t("Application language")}</span>
          <select
            value={settings.language}
            onChange={(event) =>
              patch("language", event.target.value as AppSettings["language"])
            }
          >
            <option value="en">English</option>
            <option value="ur">Urdu</option>
          </select>
        </label>
      </Section>

      <Section
        title={t("Notifications")}
        text="Control which social activity can notify you."
      >
        <Toggle checked={settings.notify_likes} onChange={(v) => patch("notify_likes", v)} label={t("Likes")} />
        <Toggle checked={settings.notify_comments} onChange={(v) => patch("notify_comments", v)} label={t("Comments")} />
        <Toggle checked={settings.notify_followers} onChange={(v) => patch("notify_followers", v)} label={t("New followers")} />
        <Toggle checked={settings.notify_messages} onChange={(v) => patch("notify_messages", v)} label={t("Messages")} />
        <Toggle checked={settings.notify_mentions} onChange={(v) => patch("notify_mentions", v)} label={t("Mentions")} />
        <Toggle checked={settings.notify_stories} onChange={(v) => patch("notify_stories", v)} label={t("Stories")} />
        <Toggle checked={settings.notify_reels} onChange={(v) => patch("notify_reels", v)} label={t("Reels")} />
        <Toggle checked={settings.notify_other} onChange={(v) => patch("notify_other", v)} label={t("Other activity")} />
      </Section>

      <Section
        title={t("Feed Preferences")}
        text="Tune what the home feed does and how much data it uses."
      >
        <Toggle checked={settings.show_suggested_posts} onChange={(v) => patch("show_suggested_posts", v)} label={t("Show suggested posts")} />
        <Toggle checked={settings.feed_autoplay_videos} onChange={(v) => patch("feed_autoplay_videos", v)} label={t("Autoplay videos in feed")} />
        <Toggle checked={settings.show_sensitive_content} onChange={(v) => patch("show_sensitive_content", v)} label={t("Show sensitive content")} />
        <Toggle checked={settings.data_saving_mode} onChange={(v) => patch("data_saving_mode", v)} label={t("Data-saving mode")} />
      </Section>

      <Section
        title={t("Media Settings")}
        text="Control playback quality and upload behavior."
      >
        <Toggle checked={settings.media_autoplay_videos} onChange={(v) => patch("media_autoplay_videos", v)} label={t("Autoplay videos")} />
        <Toggle checked={settings.high_quality_uploads} onChange={(v) => patch("high_quality_uploads", v)} label={t("High-quality media uploads")} />
        <Toggle checked={settings.use_less_mobile_data} onChange={(v) => patch("use_less_mobile_data", v)} label={t("Use less mobile data")} />
      </Section>

      <Section
        title={t("Accessibility")}
        text="Adjust motion, text size and contrast."
      >
        <Toggle checked={settings.reduce_animations} onChange={(v) => patch("reduce_animations", v)} label={t("Reduce animations")} />
        <Toggle checked={settings.larger_text} onChange={(v) => patch("larger_text", v)} label={t("Larger text")} />
        <Toggle checked={settings.high_contrast} onChange={(v) => patch("high_contrast", v)} label={t("High contrast mode")} />
      </Section>

      <Section
        title={t("App Behavior")}
        text="Choose how AVENZO confirms actions."
      >
        <Toggle checked={settings.confirm_delete_content} onChange={(v) => patch("confirm_delete_content", v)} label={t("Confirm before deleting content")} />
        <Toggle checked={settings.confirm_unfollow} onChange={(v) => patch("confirm_unfollow", v)} label={t("Confirm before unfollowing")} />
        <Toggle
          checked={settings.auto_save_settings}
          onChange={(v) => patch("auto_save_settings", v)}
          label={t("Save settings automatically")}
          description="When off, use the Save App Settings button below."
        />
      </Section>

      <div className="settings-save-bar">
        <div role="status" aria-live="polite">{status}</div>
        <button
          className="btn"
          disabled={saving}
          onClick={() => void persist()}
        >
          {saving ? "Saving…" : t("Save App Settings")}
        </button>
      </div>
    </div>
  );
}
