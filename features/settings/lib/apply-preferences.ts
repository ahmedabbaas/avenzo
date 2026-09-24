import type { AppSettings } from "../types";

export function applyAppPreferences(settings: AppSettings) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const effectiveTheme =
    settings.theme === "system"
      ? prefersDark
        ? "dark"
        : "light"
      : settings.theme;

  root.dataset.theme = effectiveTheme;
  root.dataset.themePreference = settings.theme;
  root.dataset.reduceMotion = settings.reduce_animations ? "true" : "false";
  root.dataset.largeText = settings.larger_text ? "true" : "false";
  root.dataset.highContrast = settings.high_contrast ? "true" : "false";
  root.dataset.dataSaving = settings.data_saving_mode ? "true" : "false";
  root.dataset.lessMobileData = settings.use_less_mobile_data ? "true" : "false";
  root.lang = settings.language;
  root.dir = settings.language === "ur" ? "rtl" : "ltr";

  const runtimePreferences = {
    confirm_delete_content: settings.confirm_delete_content,
    confirm_unfollow: settings.confirm_unfollow,
    feed_autoplay_videos: settings.feed_autoplay_videos,
    media_autoplay_videos: settings.media_autoplay_videos,
    data_saving_mode: settings.data_saving_mode,
    use_less_mobile_data: settings.use_less_mobile_data,
    high_quality_uploads: settings.high_quality_uploads,
    show_suggested_posts: settings.show_suggested_posts,
  };

  try {
    window.localStorage.setItem(
      "avenzo-runtime-preferences",
      JSON.stringify(runtimePreferences)
    );
  } catch {
    // Storage can be unavailable in privacy modes; visual preferences still apply.
  }

  window.dispatchEvent(
    new CustomEvent("avenzo:preferences", { detail: runtimePreferences })
  );
}
