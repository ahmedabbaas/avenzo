import AccountSettingsForm from "../../../features/settings/components/account-settings-form";
import SettingsShell from "../../../features/settings/components/settings-shell";
import type { PrivacySettings } from "../../../features/settings/types";
import { requireSettingsUser } from "../../../features/settings/server/settings-user";

export const metadata = { title: "Profile & Account" };
export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const { supabase, user, profile } = await requireSettingsUser();

  const { data: privacy } = await supabase
    .from("privacy_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return (
    <SettingsShell
      eyebrow="ACCOUNT"
      title="Profile & Account"
      description="Profile information, username, security, privacy and account actions."
    >
      <AccountSettingsForm
        initialProfile={profile}
        initialPrivacy={privacy as PrivacySettings}
        email={user.email || ""}
        phone={user.phone || ""}
      />
    </SettingsShell>
  );
}
