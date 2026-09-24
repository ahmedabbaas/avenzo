import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import BrandLogo from "../../components/brand-logo";
import MessagesWorkspace from "../../features/messages/components/messages-workspace";

export const metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    user?: string;
    sharePost?: string;
    shareReel?: string;
    shareProfile?: string;
  }>;
}) {
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

  const params = await searchParams;

  return (
    <main className="messages-page">
      <header className="messages-page-topbar">
        <a className="messages-brand" href="/home" aria-label="Back to AVENZO home">
          <BrandLogo size={32} />
          <b>AVENZO</b>
        </a>
        <a className="btn secondary small" href="/home">
          Back to Home
        </a>
      </header>

      <MessagesWorkspace
        currentUser={profile}
        initialUsername={typeof params.user === "string" ? params.user : ""}
        sharePostId={typeof params.sharePost === "string" ? params.sharePost : ""}
        shareReelId={typeof params.shareReel === "string" ? params.shareReel : ""}
        shareProfileId={
          typeof params.shareProfile === "string" ? params.shareProfile : ""
        }
      />
    </main>
  );
}
