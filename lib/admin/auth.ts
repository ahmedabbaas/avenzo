import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";

export async function requireAdmin() {
  const adminEmail = process.env.AVENZO_ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) redirect("/");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || user.email.trim().toLowerCase() !== adminEmail) redirect("/");

  return user;
}

export function isAdminEmail(email?: string | null) {
  const configured = process.env.AVENZO_ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(configured && email?.trim().toLowerCase() === configured);
}
