import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "../social/types";
import type { GroupChat, GroupMember, GroupMessage } from "./group-types";

function assertNoError(error: unknown) {
  if (error) throw error;
}

export async function fetchGroupChats(
  supabase: SupabaseClient,
  userId: string
): Promise<GroupChat[]> {
  const membership = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId)
    .is("left_at", null);

  assertNoError(membership.error);
  const ids = (membership.data || []).map((row) => row.group_id);
  if (!ids.length) return [];

  const [groups, messages, members] = await Promise.all([
    supabase
      .from("group_chats")
      .select("id,title,avatar_url,created_by,created_at,updated_at,last_message_at")
      .in("id", ids),
    supabase
      .from("group_messages")
      .select("id,group_id,body,created_at,deleted_at")
      .in("group_id", ids)
      .order("created_at", { ascending: false }),
    supabase
      .from("group_members")
      .select("group_id,user_id")
      .in("group_id", ids)
      .is("left_at", null),
  ]);

  assertNoError(groups.error);
  assertNoError(messages.error);
  assertNoError(members.error);

  const lastByGroup = new Map<string, { body: string; created_at: string }>();
  for (const row of messages.data || []) {
    if (!lastByGroup.has(row.group_id)) {
      lastByGroup.set(row.group_id, {
        body: row.deleted_at ? "Message deleted" : row.body,
        created_at: row.created_at,
      });
    }
  }

  const countByGroup = new Map<string, number>();
  for (const row of members.data || []) {
    countByGroup.set(row.group_id, (countByGroup.get(row.group_id) || 0) + 1);
  }

  return (groups.data || [])
    .map((group) => {
      const last = lastByGroup.get(group.id);
      return {
        ...group,
        member_count: countByGroup.get(group.id) || 0,
        last_message: last?.body || "No messages yet",
        last_message_at_effective:
          last?.created_at || group.last_message_at || group.created_at,
      } as GroupChat;
    })
    .sort(
      (a, b) =>
        new Date(b.last_message_at_effective).getTime() -
        new Date(a.last_message_at_effective).getTime()
    );
}

export async function fetchGroupMembers(
  supabase: SupabaseClient,
  groupId: string
): Promise<GroupMember[]> {
  const membership = await supabase
    .from("group_members")
    .select("user_id,role,joined_at")
    .eq("group_id", groupId)
    .is("left_at", null);

  assertNoError(membership.error);
  const ids = (membership.data || []).map((row) => row.user_id);
  if (!ids.length) return [];

  const profiles = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url,verified")
    .in("id", ids);
  assertNoError(profiles.error);

  const profileMap = new Map((profiles.data || []).map((p) => [p.id, p]));

  return (membership.data || []).flatMap((row) => {
    const profile = profileMap.get(row.user_id);
    if (!profile) return [];
    return [{
      user_id: row.user_id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      verified: Boolean(profile.verified),
      role: row.role as GroupMember["role"],
      joined_at: row.joined_at,
    }];
  });
}

export async function fetchGroupMessages(
  supabase: SupabaseClient,
  groupId: string
): Promise<GroupMessage[]> {
  const result = await supabase
    .from("group_messages")
    .select(
      "id,group_id,sender_id,body,message_type,reply_to_id,created_at,updated_at,edited_at,deleted_at"
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: true })
    .limit(300);

  assertNoError(result.error);
  const rows = (result.data || []) as GroupMessage[];
  const senderIds = [...new Set(rows.map((row) => row.sender_id))];

  const members = senderIds.length
    ? await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,verified")
        .in("id", senderIds)
    : { data: [], error: null };

  assertNoError(members.error);
  const profileMap = new Map((members.data || []).map((p) => [p.id, p]));

  return rows.map((row) => {
    const p = profileMap.get(row.sender_id);
    return {
      ...row,
      sender: p
        ? {
            user_id: p.id,
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            verified: Boolean(p.verified),
            role: "member",
            joined_at: "",
          }
        : null,
    };
  });
}

export async function createGroupChat(
  supabase: SupabaseClient,
  title: string,
  memberIds: string[]
) {
  const { data, error } = await supabase.rpc("create_group_chat", {
    group_title: title,
    member_ids: memberIds,
  });
  assertNoError(error);
  return data as string;
}

export async function sendGroupMessage(
  supabase: SupabaseClient,
  groupId: string,
  body: string,
  replyToId: string | null = null
) {
  const { data, error } = await supabase.rpc("send_group_message", {
    gid: groupId,
    message_body: body,
    reply_mid: replyToId,
  });
  assertNoError(error);
  return data as string;
}

export async function leaveGroupChat(
  supabase: SupabaseClient,
  groupId: string
) {
  const { error } = await supabase.rpc("leave_group_chat", { gid: groupId });
  assertNoError(error);
}

export async function searchGroupCandidates(
  supabase: SupabaseClient,
  currentUserId: string,
  search = ""
): Promise<Profile[]> {
  let query = supabase
    .from("profiles")
    .select("id,username,display_name,bio,avatar_url,verified,created_at")
    .neq("id", currentUserId)
    .limit(40);

  const clean = search.trim().replace(/[,%]/g, "");
  if (clean) {
    query = query.or(
      "username.ilike.%" + clean + "%,display_name.ilike.%" + clean + "%"
    );
  }

  const { data, error } = await query.order("created_at", {
    ascending: false,
  });
  assertNoError(error);
  return (data || []) as Profile[];
}
