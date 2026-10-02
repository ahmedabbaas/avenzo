import { redirect } from "next/navigation";
import SettingsShell from "../../features/settings/components/settings-shell";
import CreatorInsightsClient from "../../features/social/components/creator-insights-client";
import { createClient } from "../../lib/supabase/server";

export const metadata = { title: "Creator Insights" };
export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/login?error=verify");

  return (
    <SettingsShell
      eyebrow="CREATOR"
      title="Creator Insights"
      description="Understand how your real AVENZO posts, Clips and audience are performing."
    >
      <CreatorInsightsClient userId={user.id} />
    </SettingsShell>
  );
}
