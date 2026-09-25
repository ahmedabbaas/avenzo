import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import BrandLogo from "../../components/brand-logo";
import BroadcastChannelsWorkspace from "../../features/messages/components/broadcast-channels-workspace";

export const metadata = { title: "Channels" };
export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?error=verify");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,username,display_name,bio,avatar_url,verified,created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/login?error=profile");

  return (
    <main className="messages-page">
      <header className="messages-page-topbar">
        <a className="messages-brand" href="/messages" aria-label="Back to messages">
          <BrandLogo size={32} />
          <b>AVENZO</b>
        </a>
        <a className="btn secondary small" href="/messages">
          Messages
        </a>
      </header>

      <BroadcastChannelsWorkspace currentUser={profile} />
    </main>
  );
}
