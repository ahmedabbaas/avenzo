"use client";

import { useEffect, useState } from "react";

export type RuntimePreferences = {
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
  confirm_delete_content: true,
  confirm_unfollow: true,
  feed_autoplay_videos: true,
  media_autoplay_videos: true,
  data_saving_mode: false,
  use_less_mobile_data: false,
  high_quality_uploads: true,
  show_suggested_posts: true,
};

function readStored(): RuntimePreferences {
  if (typeof window === "undefined") return DEFAULTS;

  try {
    const raw = window.localStorage.getItem("avenzo-runtime-preferences");
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function useRuntimePreferences() {
  const [preferences, setPreferences] = useState<RuntimePreferences>(readStored);

  useEffect(() => {
    function sync(event: Event) {
      const detail = (event as CustomEvent<Partial<RuntimePreferences>>).detail;
      setPreferences((current) => ({ ...current, ...detail }));
    }

    window.addEventListener("avenzo:preferences", sync);
    return () => window.removeEventListener("avenzo:preferences", sync);
  }, []);

  return preferences;
}
