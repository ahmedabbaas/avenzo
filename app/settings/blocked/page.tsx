import BlockedAccountsClient from "../../../features/settings/components/blocked-accounts-client";
import SettingsShell from "../../../features/settings/components/settings-shell";
import { requireSettingsUser } from "../../../features/settings/server/settings-user";

export const metadata = { title: "Blocked Accounts" };
export const dynamic = "force-dynamic";

export default async function BlockedAccountsPage() {
  const { supabase } = await requireSettingsUser();
  const { data } = await supabase.rpc("get_blocked_accounts");

  return (
    <SettingsShell
      eyebrow="PRIVACY"
      title="Blocked Accounts"
      description="People you have blocked cannot interact with you through normal AVENZO social flows. You can unblock them here."
    >
      <BlockedAccountsClient initialAccounts={(data || []) as never[]} />
    </SettingsShell>
  );
}
