import type { AppSettings } from "../types";

export function applyAppPreferences(settings: Pick<
  AppSettings,
  "theme" | "language" | "reduce_animations" | "larger_text" | "high_contrast"
>) {
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
  root.lang = settings.language;
  root.dir = settings.language === "ur" ? "rtl" : "ltr";
}
