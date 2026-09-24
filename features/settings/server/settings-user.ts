import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";

export async function requireSettingsUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?error=verify");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id,username,display_name,bio,avatar_url,website,gender,date_of_birth,verified,created_at"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/login?error=profile");

  return { supabase, user, profile };
}
