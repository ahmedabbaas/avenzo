import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import PublicProfileClient from "./public-profile-client";

export const dynamic = "force-dynamic";

const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: rawUsername } = await params;
  const username = decodeURIComponent(rawUsername).trim().toLowerCase();

  if (!USERNAME_PATTERN.test(username)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email_confirmed_at) redirect("/login");

  const { data: target } = await supabase
    .from("profiles")
    .select("id,username,display_name,bio,avatar_url,verified,created_at")
    .eq("username", username)
    .maybeSingle();

  if (!target) notFound();

  if (target.id === user.id) redirect("/home?screen=profile");

  const [
    postsResult,
    collaboratorResult,
    reelsResult,
    followerCountResult,
    followingCountResult,
    relationshipResult,
  ] = await Promise.all([
    supabase
      .from("posts")
      .select("id,caption,media_path,media_type,media_width,media_height,created_at")
      .eq("author_id", target.id)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("post_collaborators")
      .select("post_id")
      .eq("user_id", target.id)
      .eq("status", "accepted"),
    supabase
      .from("reels")
      .select("id,title,caption,media_path,cover_path,view_count,created_at")
      .eq("author_id", target.id)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", target.id),
    supabase
      .from("follows")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", target.id),
    supabase.rpc("get_follow_relationship", {
      target_user: target.id,
    }),
  ]);

  const collaboratorPostIds = (collaboratorResult.data || []).map(
    (row: { post_id: string }) => row.post_id
  );

  const collaboratorPostsResult = collaboratorPostIds.length
    ? await supabase
        .from("posts")
        .select("id,caption,media_path,media_type,media_width,media_height,created_at")
        .in("id", collaboratorPostIds)
    : { data: [], error: null };

  const publicPostMap = new Map<
    string,
    NonNullable<typeof postsResult.data>[number]
  >();
  for (const post of [
    ...(postsResult.data || []),
    ...(collaboratorPostsResult.data || []),
  ]) {
    publicPostMap.set(post.id, post);
  }

  const posts = [...publicPostMap.values()]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    )
    .slice(0, 60)
    .map((post) => ({
      ...post,
      media_url: post.media_path
        ? supabase.storage.from("media").getPublicUrl(post.media_path).data.publicUrl
        : "",
    }));

  const reels = (reelsResult.data || []).map((reel) => ({
    ...reel,
    media_url: supabase.storage.from("media").getPublicUrl(reel.media_path).data.publicUrl,
    cover_url: reel.cover_path
      ? supabase.storage.from("media").getPublicUrl(reel.cover_path).data.publicUrl
      : "",
  }));

  const relationshipRow = Array.isArray(relationshipResult.data)
    ? relationshipResult.data[0]
    : relationshipResult.data;
  const initialFollowState =
    relationshipRow?.state === "following"
      ? "following"
      : relationshipRow?.state === "requested"
        ? "requested"
        : "none";
  const accountPrivate = Boolean(relationshipRow?.target_private);

  return (
    <PublicProfileClient
      viewerId={user.id}
      profile={target}
      posts={posts}
      reels={reels}
      initialFollowState={initialFollowState}
      accountPrivate={accountPrivate}
      stats={{
        posts: posts.length,
        followers: followerCountResult.count || 0,
        following: followingCountResult.count || 0,
      }}
    />
  );
}
