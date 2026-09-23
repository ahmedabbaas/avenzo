import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";
import HomeClient from "./home-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email_confirmed_at) redirect("/auth?error=verify");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/auth?error=profile");

  return <HomeClient profile={profile} />;
}
