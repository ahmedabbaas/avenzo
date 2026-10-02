import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../lib/supabase/server";
import CallHistoryClient, {
  type CallHistoryRow,
} from "../../features/messages/components/call-history-client";

export const metadata = { title: "Calls" };
export const dynamic = "force-dynamic";

export default async function CallsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email_confirmed_at) redirect("/login");

  const { data: calls, error } = await supabase
    .from("call_sessions")
    .select(
      "id,conversation_id,caller_id,callee_id,status,call_type,created_at,answered_at,ended_at"
    )
    .or("caller_id.eq." + user.id + ",callee_id.eq." + user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error("Call history could not be loaded.");
  }

  const rows = (calls || []) as CallHistoryRow[];
  const otherIds = [
    ...new Set(
      rows.map((row) =>
        row.caller_id === user.id ? row.callee_id : row.caller_id
      )
    ),
  ];

  const profilesResult = otherIds.length
    ? await supabase
        .from("profiles")
        .select("id,username,display_name,bio,avatar_url,website,verified")
        .in("id", otherIds)
    : { data: [], error: null };

  if (profilesResult.error) {
    throw new Error("Call profiles could not be loaded.");
  }

  return (
    <main className="calls-page">
      <header className="calls-page-head">
        <div>
          <span>AVENZO DIRECT</span>
          <h1>Calls</h1>
          <p>Voice and video call history from your real conversations.</p>
        </div>
        <Link className="btn secondary small" href="/messages">
          Messages
        </Link>
      </header>

      <CallHistoryClient
        currentUserId={user.id}
        calls={rows}
        profiles={profilesResult.data || []}
      />
    </main>
  );
}
