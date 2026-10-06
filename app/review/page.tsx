import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import ResponsiveReview from "./responsive-review";

export const metadata = { title: "Responsive review", robots: { index: false, follow: false } };

export default async function ReviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email_confirmed_at) redirect("/login");
  return <ResponsiveReview />;
}
