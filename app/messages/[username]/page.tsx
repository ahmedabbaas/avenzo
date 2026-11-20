import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import BrandLogo from "../../../components/brand-logo";
import MessagesWorkspace from "../../../features/messages/components/messages-workspace";

export const metadata = { title: "Conversation" };
export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?error=verify");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,username,display_name,bio,avatar_url,verified,created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/login?error=profile");
  const { username } = await params;

  return (
    <main className="messages-page messages-focused-page">
      <header className="messages-page-topbar">
        <Link className="messages-brand" href="/messages" aria-label="Back to conversations">
          <BrandLogo size={32} />
          <b>AVENZO</b>
        </Link>
        <div className="messages-page-actions">
          <a className="btn secondary small" href="/calls">Calls</a>
          <a className="btn secondary small" href="/home">Home</a>
        </div>
      </header>
      <MessagesWorkspace
        currentUser={profile}
        initialUsername={username}
        focusedConversation
      />
    </main>
  );
}
