"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "../../../lib/supabase/client";
import { applyAppPreferences } from "../lib/apply-preferences";
import type { AppSettings } from "../types";

const VISUAL_STORAGE_KEY = "avenzo-visual-preferences";

const prepaintThemeScript = `
(function () {
  try {
    var root = document.documentElement;
    var raw = localStorage.getItem("avenzo-visual-preferences");
    var saved = raw ? JSON.parse(raw) : null;
    var preference = saved && saved.theme ? saved.theme : "system";
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var effective = preference === "system"
      ? (prefersDark ? "dark" : "light")
      : preference;

    root.dataset.theme = effective;
    root.dataset.themePreference = preference;

    if (saved) {
      if (typeof saved.reduceMotion === "boolean") {
        root.dataset.reduceMotion = saved.reduceMotion ? "true" : "false";
      }
      if (typeof saved.largeText === "boolean") {
        root.dataset.largeText = saved.largeText ? "true" : "false";
      }
      if (typeof saved.highContrast === "boolean") {
        root.dataset.highContrast = saved.highContrast ? "true" : "false";
      }
      if (saved.language === "en" || saved.language === "ur") {
        root.lang = saved.language;
        root.dir = saved.language === "ur" ? "rtl" : "ltr";
      }
    }

    root.style.colorScheme = effective;
  } catch (_) {
    var fallbackDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = fallbackDark ? "dark" : "light";
    document.documentElement.dataset.themePreference = "system";
  }
})();
`;

function saveVisualPreferences(settings: AppSettings) {
  try {
    window.localStorage.setItem(
      VISUAL_STORAGE_KEY,
      JSON.stringify({
        theme: settings.theme,
        language: settings.language,
        reduceMotion: settings.reduce_animations,
        largeText: settings.larger_text,
        highContrast: settings.high_contrast,
      })
    );
  } catch {
    // Visual preferences still work even when storage is unavailable.
  }
}

export default function PreferencesBootstrap() {
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let active = true;
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applySystemTheme = () => {
      if (root.dataset.themePreference !== "system") return;
      const next = media.matches ? "dark" : "light";
      root.dataset.theme = next;
      root.style.colorScheme = next;
    };

    const persistCurrentVisualState = () => {
      try {
        const existingRaw = window.localStorage.getItem(VISUAL_STORAGE_KEY);
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        window.localStorage.setItem(
          VISUAL_STORAGE_KEY,
          JSON.stringify({
            ...existing,
            theme: root.dataset.themePreference || "system",
            language: root.lang === "ur" ? "ur" : "en",
            reduceMotion: root.dataset.reduceMotion === "true",
            largeText: root.dataset.largeText === "true",
            highContrast: root.dataset.highContrast === "true",
          })
        );
      } catch {
        // Ignore storage failures.
      }
    };

    media.addEventListener?.("change", applySystemTheme);

    const observer = new MutationObserver(persistCurrentVisualState);
    observer.observe(root, {
      attributes: true,
      attributeFilter: [
        "data-theme",
        "data-theme-preference",
        "data-reduce-motion",
        "data-large-text",
        "data-high-contrast",
        "lang",
        "dir",
      ],
    });

    void supabase.auth.getUser().then(async ({ data }) => {
      if (!active || !data.user) return;

      const { data: settings } = await supabase
        .from("app_settings")
        .select("*")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (active && settings) {
        const typedSettings = settings as AppSettings;
        applyAppPreferences(typedSettings);
        saveVisualPreferences(typedSettings);
        root.style.colorScheme =
          root.dataset.theme === "light" ? "light" : "dark";
      }
    });

    return () => {
      active = false;
      observer.disconnect();
      media.removeEventListener?.("change", applySystemTheme);
    };
  }, [supabase]);

  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: prepaintThemeScript }}
    />
  );
}
