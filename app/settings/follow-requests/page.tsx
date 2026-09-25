import FollowRequestsClient from "../../../features/settings/components/follow-requests-client";
import SettingsShell from "../../../features/settings/components/settings-shell";
import { requireSettingsUser } from "../../../features/settings/server/settings-user";
import type { Profile } from "../../../features/social/types";

export const metadata = { title: "Follow Requests" };
export const dynamic = "force-dynamic";

export default async function FollowRequestsPage() {
  const { supabase, user } = await requireSettingsUser();

  const { data: rows } = await supabase
    .from("follow_requests")
    .select("requester_id,created_at")
    .eq("target_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const ids = (rows || []).map((row) => row.requester_id);

  let profiles: Profile[] = [];

  if (ids.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id,username,display_name,bio,avatar_url,verified,created_at")
      .in("id", ids);

    profiles = (data || []) as Profile[];
  }

  const profileMap = new Map(
    profiles.map((profile) => [profile.id, profile])
  );

  const requests = (rows || []).flatMap((row) => {
    const requester = profileMap.get(row.requester_id);
    return requester
      ? [{ requester, created_at: row.created_at }]
      : [];
  });

  return (
    <SettingsShell
      eyebrow="PRIVACY"
      title="Follow Requests"
      description="Approve who can follow your private account and see private posts or reels."
    >
      <FollowRequestsClient initialRequests={requests} />
    </SettingsShell>
  );
}
