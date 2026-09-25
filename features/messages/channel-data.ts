import type { SupabaseClient } from "@supabase/supabase-js";
import type { BroadcastChannel, BroadcastPost } from "./channel-types";

function assertNoError(error: unknown) {
  if (error) throw error;
}

export async function fetchBroadcastChannels(
  supabase: SupabaseClient,
  userId: string
): Promise<BroadcastChannel[]> {
  const [channels, memberships] = await Promise.all([
    supabase
      .from("broadcast_channels")
      .select("id,owner_id,title,description,avatar_url,is_public,created_at,updated_at,last_post_at")
      .order("last_post_at", { ascending: false, nullsFirst: false })
      .limit(100),
    supabase
      .from("broadcast_channel_members")
      .select("channel_id,user_id,role,left_at"),
  ]);

  assertNoError(channels.error);
  assertNoError(memberships.error);

  const rows = memberships.data || [];
  const countMap = new Map<string, number>();
  const ownMap = new Map<string, { role: BroadcastChannel["role"]; joined: boolean }>();

  for (const row of rows) {
    if (!row.left_at) {
      countMap.set(row.channel_id, (countMap.get(row.channel_id) || 0) + 1);
    }
    if (row.user_id === userId) {
      ownMap.set(row.channel_id, {
        role: row.left_at ? null : (row.role as BroadcastChannel["role"]),
        joined: !row.left_at,
      });
    }
  }

  return (channels.data || []).map((channel) => {
    const own = ownMap.get(channel.id);
    return {
      ...channel,
      member_count: countMap.get(channel.id) || 0,
      joined: Boolean(own?.joined),
      role: own?.role || null,
    } as BroadcastChannel;
  });
}

export async function fetchBroadcastPosts(
  supabase: SupabaseClient,
  channelId: string
): Promise<BroadcastPost[]> {
  const posts = await supabase
    .from("broadcast_channel_posts")
    .select("id,channel_id,author_id,body,created_at,edited_at,deleted_at")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: true })
    .limit(300);

  assertNoError(posts.error);
  const rows = posts.data || [];
  const ids = [...new Set(rows.map((row) => row.author_id))];

  const profiles = ids.length
    ? await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,verified")
        .in("id", ids)
    : { data: [], error: null };

  assertNoError(profiles.error);
  const profileMap = new Map((profiles.data || []).map((p) => [p.id, p]));

  return rows.map((row) => {
    const profile = profileMap.get(row.author_id);
    return {
      ...row,
      author_name: profile?.display_name || "AVENZO creator",
      author_username: profile?.username || "user",
      author_avatar_url: profile?.avatar_url || null,
      author_verified: Boolean(profile?.verified),
    } as BroadcastPost;
  });
}

export async function createBroadcastChannel(
  supabase: SupabaseClient,
  title: string,
  description: string
) {
  const { data, error } = await supabase.rpc("create_broadcast_channel", {
    channel_title: title,
    channel_description: description,
  });
  assertNoError(error);
  return data as string;
}

export async function joinBroadcastChannel(
  supabase: SupabaseClient,
  channelId: string
) {
  const { error } = await supabase.rpc("join_broadcast_channel", {
    cid: channelId,
  });
  assertNoError(error);
}

export async function leaveBroadcastChannel(
  supabase: SupabaseClient,
  channelId: string
) {
  const { error } = await supabase.rpc("leave_broadcast_channel", {
    cid: channelId,
  });
  assertNoError(error);
}

export async function publishBroadcastPost(
  supabase: SupabaseClient,
  channelId: string,
  body: string
) {
  const { data, error } = await supabase.rpc("publish_broadcast_post", {
    cid: channelId,
    post_body: body,
  });
  assertNoError(error);
  return data as string;
}
