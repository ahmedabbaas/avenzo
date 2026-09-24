import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import ReelsPanel from "../../features/social/components/reels-panel";

export const metadata = { title: "Reels" };
export const dynamic = "force-dynamic";

export default async function ReelsPage({
  searchParams,
}: {
  searchParams: Promise<{ reel?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email_confirmed_at) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,username,display_name,bio,avatar_url,verified,is_admin,created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/login?error=profile");

  const params = await searchParams;

  return (
    <ReelsPanel
      currentUser={profile}
      initialReelId={typeof params.reel === "string" ? params.reel : ""}
    />
  );
}
