import SettingsShell from "../../features/settings/components/settings-shell";
import SettingsHub from "../../features/settings/components/settings-hub";
import { requireSettingsUser } from "../../features/settings/server/settings-user";
import type { AppSettings } from "../../features/settings/types";
import type { Profile } from "../../features/social/types";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { supabase, user, profile } = await requireSettingsUser();
  const { data: appSettings } = await supabase
    .from("app_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return (
    <SettingsShell
      eyebrow="SETTINGS"
      title="Settings"
      description="App preferences and account controls stay separated, so changing how AVENZO behaves never gets mixed with personal account security."
    >
      <SettingsHub
        profile={profile as Profile}
        initialSettings={appSettings as AppSettings}
      />
    </SettingsShell>
  );
}
