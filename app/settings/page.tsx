import SettingsShell from "../../features/settings/components/settings-shell";
import SettingsHub from "../../features/settings/components/settings-hub";
import { requireSettingsUser } from "../../features/settings/server/settings-user";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireSettingsUser();

  return (
    <SettingsShell
      eyebrow="SETTINGS"
      title="Settings"
      description="App preferences and account controls stay separated, so changing how AVENZO behaves never gets mixed with personal account security."
    >
      <SettingsHub />
    </SettingsShell>
  );
}
