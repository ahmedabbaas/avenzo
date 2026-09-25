import CloseFriendsClient from "../../../features/settings/components/close-friends-client";
import SettingsShell from "../../../features/settings/components/settings-shell";
import { requireSettingsUser } from "../../../features/settings/server/settings-user";
import type { Profile } from "../../../features/social/types";

export const metadata = { title: "Close Friends" };
export const dynamic = "force-dynamic";

export default async function CloseFriendsPage() {
  const { supabase, user } = await requireSettingsUser();

  const { data: rows } = await supabase
    .from("close_friends")
    .select("friend_id")
    .eq("user_id", user.id);

  const ids = (rows || []).map((row) => row.friend_id);

  let friends: Profile[] = [];

  if (ids.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id,username,display_name,bio,avatar_url,verified,created_at")
      .in("id", ids)
      .order("display_name", { ascending: true });

    friends = (data || []) as Profile[];
  }

  return (
    <SettingsShell
      eyebrow="AUDIENCE"
      title="Close Friends"
      description="Build a private audience for Notes, Stories and future AVENZO sharing controls. Only you can see this list."
    >
      <CloseFriendsClient
        currentUserId={user.id}
        initialFriends={friends}
      />
    </SettingsShell>
  );
}
