import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import HomeClient from "../home-client";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string; screen?: string }>;
}) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    redirect("/login?error=backend");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?error=verify");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/login?error=profile");

  const params = await searchParams;
  const initialChatUsername =
    typeof params.chat === "string" ? params.chat.toLowerCase() : "";
  const initialScreen =
    params.screen === "profile" ? "profile" : undefined;

  return (
    <HomeClient
      profile={profile}
      initialChatUsername={initialChatUsername}
      initialScreen={initialScreen}
    />
  );
}
