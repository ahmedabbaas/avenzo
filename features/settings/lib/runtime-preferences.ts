"use client";

import { useEffect, useState } from "react";

export type RuntimePreferences = {
  language: "en" | "ur";
  confirm_delete_content: boolean;
  confirm_unfollow: boolean;
  feed_autoplay_videos: boolean;
  media_autoplay_videos: boolean;
  data_saving_mode: boolean;
  use_less_mobile_data: boolean;
  high_quality_uploads: boolean;
  show_suggested_posts: boolean;
};

const DEFAULTS: RuntimePreferences = {
  language: "en",
  confirm_delete_content: true,
  confirm_unfollow: true,
  feed_autoplay_videos: true,
  media_autoplay_videos: true,
  data_saving_mode: false,
  use_less_mobile_data: false,
  high_quality_uploads: true,
  show_suggested_posts: true,
};

export function normalizeRuntimePreferences(value: unknown): RuntimePreferences {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const result = { ...DEFAULTS };
  result.language = input.language === "ur" ? "ur" : "en";
  for (const key of Object.keys(DEFAULTS) as Array<keyof RuntimePreferences>) {
    if (key !== "language" && typeof input[key] === "boolean") result[key] = input[key];
  }
  return result;
}

function readStored(): RuntimePreferences {
  if (typeof window === "undefined") return DEFAULTS;

  try {
    const raw = window.localStorage.getItem("avenzo-runtime-preferences");
    if (!raw) return DEFAULTS;
    return normalizeRuntimePreferences(JSON.parse(raw));
  } catch {
    return DEFAULTS;
  }
}

export function useRuntimePreferences() {
  const [preferences, setPreferences] = useState<RuntimePreferences>(readStored);

  useEffect(() => {
    function sync(event: Event) {
      const detail = (event as CustomEvent<Partial<RuntimePreferences>>).detail;
      setPreferences((current) => normalizeRuntimePreferences({ ...current, ...detail }));
    }

    function syncStorage(event: StorageEvent) {
      if (event.key === "avenzo-runtime-preferences") setPreferences(readStored());
    }

    window.addEventListener("avenzo:preferences", sync);
    window.addEventListener("storage", syncStorage);
    return () => {
      window.removeEventListener("avenzo:preferences", sync);
      window.removeEventListener("storage", syncStorage);
    };
  }, []);

  return preferences;
}
