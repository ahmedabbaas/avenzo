import AppSettingsForm from "../../../features/settings/components/app-settings-form";
import SettingsShell from "../../../features/settings/components/settings-shell";
import type { AppSettings } from "../../../features/settings/types";
import { requireSettingsUser } from "../../../features/settings/server/settings-user";

export const metadata = { title: "App Settings" };
export const dynamic = "force-dynamic";

export default async function AppSettingsPage() {
  const { supabase, user } = await requireSettingsUser();
  const { data } = await supabase
    .from("app_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return (
    <SettingsShell
      eyebrow="APP"
      title="App Settings"
      description="Appearance, language, notifications, feed, media, accessibility and app behavior."
    >
      <AppSettingsForm initialSettings={data as AppSettings} />
    </SettingsShell>
  );
}
