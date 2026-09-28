import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../../../lib/supabase/server";
import {
  fetchProfilePostsForViewer,
  fetchSavedPostIds,
} from "../../../../../features/social/data/queries";
import MobileProfilePostsClient from "./mobile-profile-posts-client";

export const dynamic = "force-dynamic";

const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

export default async function MobileProfilePostsPage({
  params,
}: {
  params: Promise<{ username: string; id: string }>;
}) {
  const { username: rawUsername, id } = await params;
  const username = decodeURIComponent(rawUsername).trim().toLowerCase();

  if (!USERNAME_PATTERN.test(username)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email_confirmed_at) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,username,display_name,bio,avatar_url,website,verified,created_at")
    .eq("username", username)
    .maybeSingle();

  if (!profile) notFound();

  if (profile.id !== user.id) {
    const { data: relationshipData } = await supabase.rpc(
      "get_follow_relationship",
      { target_user: profile.id }
    );
    const relationship = Array.isArray(relationshipData)
      ? relationshipData[0]
      : relationshipData;

    if (relationship?.target_private && relationship?.state !== "following") {
      redirect("/u/" + encodeURIComponent(profile.username));
    }
  }

  const [posts, saved] = await Promise.all([
    fetchProfilePostsForViewer(supabase, user.id, profile.id, 60),
    fetchSavedPostIds(supabase, user.id),
  ]);

  if (!posts.length) {
    redirect(
      profile.id === user.id
        ? "/home?screen=profile"
        : "/u/" + encodeURIComponent(profile.username)
    );
  }

  return (
    <MobileProfilePostsClient
      currentUserId={user.id}
      profile={profile}
      initialPosts={posts}
      initialSaved={saved}
      initialPostId={posts.some((post) => post.id === id) ? id : posts[0].id}
    />
  );
}
