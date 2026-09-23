import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";
import HomeClient from "./home-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const hasBackend =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  if (!hasBackend) {
    redirect("/auth?error=backend");
  }

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
