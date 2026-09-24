"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "../../../lib/supabase/client";
import { applyAppPreferences } from "../lib/apply-preferences";
import type { AppSettings } from "../types";

export default function PreferencesBootstrap() {
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let active = true;

    void supabase.auth.getUser().then(async ({ data }) => {
      if (!active || !data.user) return;

      const { data: settings } = await supabase
        .from("app_settings")
        .select("*")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (active && settings) {
        applyAppPreferences(settings as AppSettings);
      }
    });

    return () => {
      active = false;
    };
  }, [supabase]);

  return null;
}
