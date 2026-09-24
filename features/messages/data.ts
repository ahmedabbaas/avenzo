import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "../social/types";
import type {
  DirectMessage,
  InboxConversation,
  MessageAttachment,
  MessageReaction,
  SharedPostPreview,
  SharedProfilePreview,
  SharedReelPreview,
} from "./types";

const PROFILE_COLUMNS =
  "id,username,display_name,bio,avatar_url,verified,created_at";

function assertNoError(error: unknown) {
  if (error) throw error;
}

export async function fetchInbox(
  supabase: SupabaseClient,
  requests = false
): Promise<InboxConversation[]> {
  const { data, error } = await supabase.rpc("get_dm_inbox_v2", {
    include_requests: requests,
  });
  assertNoError(error);

  const rows = ((data || []) as InboxConversation[]).map((item) => ({
    ...item,
    verified: false,
    unread_count: Number(item.unread_count || 0),
  }));

  const userIds = [...new Set(rows.map((item) => item.other_user_id))];
  if (!userIds.length) return rows;

  const verificationResult = await supabase
    .from("profiles")
    .select("id,verified")
    .in("id", userIds);

  assertNoError(verificationResult.error);

  const verifiedMap = new Map(
    (verificationResult.data || []).map((profile) => [
      profile.id,
      Boolean(profile.verified),
    ])
  );

  return rows.map((item) => ({
    ...item,
    verified: verifiedMap.get(item.other_user_id) || false,
  }));
}

export async function fetchMessageUsers(
  supabase: SupabaseClient,
  userId: string,
  search = ""
): Promise<Profile[]> {
  let query = supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .neq("id", userId)
    .limit(30);

  const clean = search.trim();
  if (clean) {
    query = query.or(
      `username.ilike.%${clean.replace(/[,%]/g, "")}%,display_name.ilike.%${clean.replace(/[,%]/g, "")}%`
    );
  }

  const { data, error } = await query.order("created_at", {
    ascending: false,
  });
  assertNoError(error);
  return (data || []) as Profile[];
}

export async function fetchConversationMessages(
  supabase: SupabaseClient,
  conversationId: string
): Promise<DirectMessage[]> {
  const { data, error } = await supabase.rpc("get_dm_messages", {
    cid: conversationId,
  });

  assertNoError(error);
  const rows = (data || []) as DirectMessage[];

  if (!rows.length) return [];

  const ids = rows.map((message) => message.id);
  const [attachmentResult, reactionResult] = await Promise.all([
    supabase
      .from("message_attachments")
      .select("*")
      .in("message_id", ids),
    supabase
      .from("message_reactions")
      .select("*")
      .in("message_id", ids),
  ]);

  assertNoError(attachmentResult.error);
  assertNoError(reactionResult.error);

  const attachments = (attachmentResult.data || []) as MessageAttachment[];
  const reactions = (reactionResult.data || []) as MessageReaction[];
  const byId = new Map(rows.map((message) => [message.id, message]));

  const postIds = [...new Set(rows.flatMap((message) =>
    message.shared_post_id ? [message.shared_post_id] : []
  ))];
  const reelIds = [...new Set(rows.flatMap((message) =>
    message.shared_reel_id ? [message.shared_reel_id] : []
  ))];
  const profileIds = [...new Set(rows.flatMap((message) =>
    message.shared_profile_id ? [message.shared_profile_id] : []
  ))];

  const [postResult, reelResult, sharedProfileResult] = await Promise.all([
    postIds.length
      ? supabase
          .from("posts")
          .select("id,author_id,caption,media_path,media_type")
          .in("id", postIds)
      : Promise.resolve({ data: [], error: null }),
    reelIds.length
      ? supabase
          .from("reels")
          .select("id,author_id,title,caption,media_path,cover_path")
          .in("id", reelIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length
      ? supabase
          .from("profiles")
          .select("id,username,display_name,avatar_url,verified")
          .in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  assertNoError(postResult.error);
  assertNoError(reelResult.error);
  assertNoError(sharedProfileResult.error);

  const contentAuthorIds = [
    ...new Set([
      ...(postResult.data || []).map((item) => item.author_id),
      ...(reelResult.data || []).map((item) => item.author_id),
    ]),
  ];

  const authorResult = contentAuthorIds.length
    ? await supabase
        .from("profiles")
        .select("id,username,display_name,verified")
        .in("id", contentAuthorIds)
    : { data: [], error: null };

  assertNoError(authorResult.error);

  const authorMap = new Map(
    (authorResult.data || []).map((author) => [author.id, author])
  );

  const postMap = new Map<string, SharedPostPreview>(
    (postResult.data || []).map((post) => {
      const author = authorMap.get(post.author_id);
      return [
        post.id,
        {
          id: post.id,
          caption: post.caption,
          media_path: post.media_path,
          media_type: post.media_type,
          creator_username: author?.username || "user",
          creator_name: author?.display_name || "AVENZO user",
          creator_verified: Boolean(author?.verified),
        },
      ];
    })
  );

  const reelMap = new Map<string, SharedReelPreview>(
    (reelResult.data || []).map((reel) => {
      const author = authorMap.get(reel.author_id);
      return [
        reel.id,
        {
          id: reel.id,
          title: reel.title || "",
          caption: reel.caption,
          media_path: reel.media_path,
          cover_path: reel.cover_path || null,
          creator_username: author?.username || "user",
          creator_name: author?.display_name || "AVENZO user",
          creator_verified: Boolean(author?.verified),
        },
      ];
    })
  );

  const sharedProfileMap = new Map<string, SharedProfilePreview>(
    (sharedProfileResult.data || []).map((profile) => [
      profile.id,
      profile as SharedProfilePreview,
    ])
  );

  return rows.map((message) => {
    const replied = message.reply_to_id
      ? byId.get(message.reply_to_id)
      : undefined;

    return {
      ...message,
      attachments: attachments.filter(
        (attachment) => attachment.message_id === message.id
      ),
      reactions: reactions.filter(
        (reaction) => reaction.message_id === message.id
      ),
      reply_to: replied
        ? {
            ...replied,
            attachments: [],
            reactions: [],
          }
        : null,
      shared_post: message.shared_post_id
        ? postMap.get(message.shared_post_id) || null
        : null,
      shared_reel: message.shared_reel_id
        ? reelMap.get(message.shared_reel_id) || null
        : null,
      shared_profile: message.shared_profile_id
        ? sharedProfileMap.get(message.shared_profile_id) || null
        : null,
    } as DirectMessage;
  });
}

export async function ensureConversation(
  supabase: SupabaseClient,
  otherUserId: string
) {
  const { data, error } = await supabase.rpc(
    "get_or_create_direct_conversation",
    { other_user: otherUserId }
  );
  assertNoError(error);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.conversation_id) {
    throw new Error("Conversation could not be created.");
  }

  return {
    conversationId: row.conversation_id as string,
    requestStatus: String(row.request_status || "accepted"),
  };
}

export async function getExistingConversation(
  supabase: SupabaseClient,
  otherUserId: string
) {
  const { data, error } = await supabase.rpc("get_direct_conversation", {
    other_user: otherUserId,
  });
  assertNoError(error);
  return (data as string | null) || null;
}

export async function markMessagesRead(
  supabase: SupabaseClient,
  conversationId: string
) {
  const { error } = await supabase.rpc("mark_conversation_read", {
    cid: conversationId,
  });
  assertNoError(error);
}

export async function markMessageDelivered(
  supabase: SupabaseClient,
  messageId: string
) {
  const { error } = await supabase.rpc("mark_message_delivered", {
    mid: messageId,
  });
  assertNoError(error);
}

export async function sendDirectMessage({
  supabase,
  conversationId,
  senderId,
  recipientId,
  body,
  replyToId = null,
  messageType = "text",
  sharedPostId = null,
  sharedReelId = null,
  sharedProfileId = null,
}: {
  supabase: SupabaseClient;
  conversationId: string;
  senderId: string;
  recipientId: string;
  body: string;
  replyToId?: string | null;
  messageType?: DirectMessage["message_type"];
  sharedPostId?: string | null;
  sharedReelId?: string | null;
  sharedProfileId?: string | null;
}) {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      recipient_id: recipientId,
      body: body.trim(),
      message_type: messageType,
      reply_to_id: replyToId,
      shared_post_id: sharedPostId,
      shared_reel_id: sharedReelId,
      shared_profile_id: sharedProfileId,
    })
    .select("*")
    .single();

  assertNoError(error);
  return data as DirectMessage;
}

export async function sendMessageAttachment({
  supabase,
  conversationId,
  senderId,
  recipientId,
  file,
  replyToId,
}: {
  supabase: SupabaseClient;
  conversationId: string;
  senderId: string;
  recipientId: string;
  file: File;
  replyToId?: string | null;
}) {
  const kind = file.type.startsWith("image/")
    ? "image"
    : file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("audio/")
        ? "audio"
        : "file";

  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8) || "bin";

  const path =
    senderId +
    "/messages/" +
    crypto.randomUUID() +
    "." +
    extension;

  const upload = await supabase.storage.from("media").upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  assertNoError(upload.error);

  try {
    const message = await sendDirectMessage({
      supabase,
      conversationId,
      senderId,
      recipientId,
      body: "",
      replyToId,
      messageType: kind,
    });

    const { error } = await supabase.from("message_attachments").insert({
      message_id: message.id,
      uploader_id: senderId,
      kind,
      storage_path: path,
      mime_type: file.type,
      file_name: file.name.slice(0, 180),
      size_bytes: file.size,
    });
    assertNoError(error);

    return message;
  } catch (error) {
    await supabase.storage.from("media").remove([path]);
    throw error;
  }
}

export async function setMessageReaction(
  supabase: SupabaseClient,
  userId: string,
  messageId: string,
  emoji: string | null
) {
  if (!emoji) {
    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", userId);
    assertNoError(error);
    return;
  }

  const { error } = await supabase.from("message_reactions").upsert(
    {
      message_id: messageId,
      user_id: userId,
      emoji,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "message_id,user_id" }
  );
  assertNoError(error);
}

export async function hideMessageForMe(
  supabase: SupabaseClient,
  userId: string,
  messageId: string
) {
  const { error } = await supabase.from("message_hidden").upsert(
    { message_id: messageId, user_id: userId },
    { onConflict: "message_id,user_id" }
  );
  assertNoError(error);
}

export async function deleteMessageForEveryone(
  supabase: SupabaseClient,
  messageId: string
) {
  const { error } = await supabase.rpc("delete_message_for_everyone", {
    message_id: messageId,
  });
  assertNoError(error);
}

export async function editMessage(
  supabase: SupabaseClient,
  messageId: string,
  body: string
) {
  const { error } = await supabase.rpc("edit_own_message", {
    message_id: messageId,
    next_body: body,
  });
  assertNoError(error);
}

export async function acceptMessageRequest(
  supabase: SupabaseClient,
  conversationId: string
) {
  const { error } = await supabase.rpc("accept_message_request", {
    cid: conversationId,
  });
  assertNoError(error);
}

export async function declineMessageRequest(
  supabase: SupabaseClient,
  conversationId: string
) {
  const { error } = await supabase.rpc("decline_message_request", {
    cid: conversationId,
  });
  assertNoError(error);
}

export async function deleteMessageRequest(
  supabase: SupabaseClient,
  conversationId: string
) {
  const { error } = await supabase.rpc("delete_message_request", {
    cid: conversationId,
  });
  assertNoError(error);
}

export async function setConversationMuted(
  supabase: SupabaseClient,
  conversationId: string,
  muted: boolean
) {
  const { error } = await supabase.rpc("set_conversation_muted", {
    cid: conversationId,
    next_muted: muted,
  });
  assertNoError(error);
}

export async function setConversationTheme(
  supabase: SupabaseClient,
  conversationId: string,
  theme: InboxConversation["theme"]
) {
  const { error } = await supabase.rpc("set_conversation_theme", {
    cid: conversationId,
    next_theme: theme,
  });
  assertNoError(error);
}

export async function deleteConversationForMe(
  supabase: SupabaseClient,
  conversationId: string
) {
  const { error } = await supabase.rpc("delete_conversation_for_me", {
    cid: conversationId,
  });
  assertNoError(error);
}

export async function restrictUser(
  supabase: SupabaseClient,
  userId: string,
  otherUserId: string
) {
  const { error } = await supabase.from("restricted_accounts").upsert(
    { restrictor_id: userId, restricted_id: otherUserId },
    { onConflict: "restrictor_id,restricted_id" }
  );
  assertNoError(error);
}

export async function blockUserFromMessages(
  supabase: SupabaseClient,
  userId: string,
  otherUserId: string
) {
  const { error } = await supabase.from("blocks").upsert(
    { blocker_id: userId, blocked_id: otherUserId },
    { onConflict: "blocker_id,blocked_id" }
  );
  assertNoError(error);
}

export async function reportUserFromMessages(
  supabase: SupabaseClient,
  userId: string,
  otherUserId: string
) {
  const { error } = await supabase.from("reports").insert({
    reporter_id: userId,
    reported_user_id: otherUserId,
    reason: "other",
    details: "Reported from direct messages.",
  });
  assertNoError(error);
}

export async function reportMessage(
  supabase: SupabaseClient,
  userId: string,
  messageId: string
) {
  const { error } = await supabase.from("reports").insert({
    reporter_id: userId,
    reported_message_id: messageId,
    reason: "other",
    details: "Reported from direct messages.",
  });
  assertNoError(error);
}

export async function fetchMessagingPrivacy(
  supabase: SupabaseClient,
  otherUserId: string
) {
  const { data, error } = await supabase.rpc("get_dm_public_privacy", {
    other_user: otherUserId,
  });
  assertNoError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    onlineStatus: Boolean(row?.online_status),
    readReceipts: Boolean(row?.read_receipts),
  };
}
