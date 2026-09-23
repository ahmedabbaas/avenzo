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
    .select("id,username,display_name,bio,avatar_url,created_at")
    .eq("username", username)
    .maybeSingle();

  if (!target) notFound();

  if (target.id === user.id) redirect("/home?screen=profile");

  const [
    postsResult,
    postCountResult,
    followerCountResult,
    followingCountResult,
    followResult,
  ] = await Promise.all([
    supabase
      .from("posts")
      .select("id,caption,media_path,media_type,created_at")
      .eq("author_id", target.id)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", target.id),
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", target.id),
    supabase
      .from("follows")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", target.id),
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .eq("following_id", target.id)
      .maybeSingle(),
  ]);

  const posts = (postsResult.data || []).map((post) => ({
    ...post,
    media_url: post.media_path
      ? supabase.storage.from("media").getPublicUrl(post.media_path).data.publicUrl
      : "",
  }));

  return (
    <PublicProfileClient
      viewerId={user.id}
      profile={target}
      posts={posts}
      initialFollowing={Boolean(followResult.data)}
      stats={{
        posts: postCountResult.count || 0,
        followers: followerCountResult.count || 0,
        following: followingCountResult.count || 0,
      }}
    />
  );
}
