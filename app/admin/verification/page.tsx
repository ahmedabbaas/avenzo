import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import VerificationAdmin from "../../../features/admin/components/verification-admin";

export const metadata = { title: "Verification Admin" };
export const dynamic = "force-dynamic";

export default async function VerificationAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email_confirmed_at) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) redirect("/home");

  return (
    <main className="admin-page">
      <VerificationAdmin />
    </main>
  );
}
