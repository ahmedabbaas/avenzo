import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import HomeClient from "../home-client";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string; screen?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?error=verify");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, verified, is_admin, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/login?error=profile");

  const params = await searchParams;

  if (params.screen === "settings") {
    redirect("/settings");
  }

  const requestedChat =
    typeof params.chat === "string" ? params.chat.trim() : "";

  if (params.screen === "messages" || requestedChat) {
    const chat = requestedChat
      ? "?user=" + encodeURIComponent(requestedChat)
      : "";
    redirect("/messages" + chat);
  }

  const allowedScreens = new Set([
    "home",
    "explore",
    "activity",
    "saved",
    "profile",
  ]);
  const initialScreen =
    typeof params.screen === "string" && allowedScreens.has(params.screen)
      ? (params.screen as
          | "home"
          | "explore"
          | "activity"
          | "saved"
          | "profile")
      : undefined;

  return <HomeClient profile={profile} initialScreen={initialScreen} />;
}
