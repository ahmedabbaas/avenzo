import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import ConnectionsList from "../../../features/social/components/connections-list";

export const dynamic = "force-dynamic";

const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

export default async function ConnectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ user?: string }>;
}) {
  const { kind } = await params;
  const query = await searchParams;

  if (kind !== "followers" && kind !== "following") notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email_confirmed_at) redirect("/login");

  const requestedUsername = String(query.user || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");

  if (requestedUsername && !USERNAME_PATTERN.test(requestedUsername)) {
    notFound();
  }

  let profileQuery = supabase
    .from("profiles")
    .select("id,username,display_name,bio,avatar_url,verified");

  profileQuery = requestedUsername
    ? profileQuery.eq("username", requestedUsername)
    : profileQuery.eq("id", user.id);

  const { data: target, error } = await profileQuery.maybeSingle();

  if (error || !target) notFound();

  return (
    <ConnectionsList
      viewerId={user.id}
      target={target}
      kind={kind}
    />
  );
}
