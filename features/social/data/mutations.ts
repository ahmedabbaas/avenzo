import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaDimensions } from "../lib/media";
import type { Message, Post, Reel } from "../types";

export type CreateMode = "post" | "reel" | "story";

function assertNoError(error: unknown) {
  if (error) throw error;
}

function safeExtension(file: File) {
  return (
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8) || "bin"
  );
}

async function uploadContentMedia({
  supabase,
  userId,
  mode,
  file,
}: {
  supabase: SupabaseClient;
  userId: string;
  mode: CreateMode;
  file: File;
}) {
  const folder =
    mode === "reel" ? "reels" : mode === "story" ? "stories" : "posts";

  const path =
    userId +
    "/" +
    folder +
    "/" +
    crypto.randomUUID() +
    "." +
    safeExtension(file);

  const { error } = await supabase.storage
    .from("media")
    .upload(path, file, {
      upsert: false,
      contentType: file.type,
    });

  assertNoError(error);

  return {
    path,
    type: file.type.startsWith("video/")
      ? ("video" as const)
      : ("image" as const),
  };
}

export async function publishContent({
  supabase,
  userId,
  mode,
  caption,
  file,
  dimensions,
}: {
  supabase: SupabaseClient;
  userId: string;
  mode: CreateMode;
  caption: string;
  file: File | null;
  dimensions: MediaDimensions | null;
}) {
  let uploadedPath: string | null = null;
  let mediaType: "image" | "video" | null = null;

  try {
    if (file) {
      const uploaded = await uploadContentMedia({
        supabase,
        userId,
        mode,
        file,
      });

      uploadedPath = uploaded.path;
      mediaType = uploaded.type;
    }

    if (mode === "story") {
      const { error } = await supabase.from("stories").insert({
        author_id: userId,
        media_path: uploadedPath,
        media_type: mediaType,
        media_width:
          mediaType === "image" ? dimensions?.width || null : null,
        media_height:
          mediaType === "image" ? dimensions?.height || null : null,
      });

      assertNoError(error);
      return;
    }

    if (mode === "reel") {
      const { error } = await supabase.from("reels").insert({
        author_id: userId,
        caption: caption.trim(),
        media_path: uploadedPath,
        media_type: "video",
      });

      assertNoError(error);
      return;
    }

    const { error } = await supabase.from("posts").insert({
      author_id: userId,
      caption: caption.trim(),
      media_path: uploadedPath,
      media_type: mediaType,
      media_width:
        mediaType === "image" ? dimensions?.width || null : null,
      media_height:
        mediaType === "image" ? dimensions?.height || null : null,
    });

    assertNoError(error);
  } catch (error) {
    if (uploadedPath) {
      await supabase.storage.from("media").remove([uploadedPath]);
    }
    throw error;
  }
}

export async function removePost(
  supabase: SupabaseClient,
  userId: string,
  post: Post
) {
  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", post.id)
    .eq("author_id", userId);

  assertNoError(error);

  if (post.media_path) {
    await supabase.storage.from("media").remove([post.media_path]);
  }
}

export async function setPostLike(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
  currentlyLiked: boolean
) {
  const result = currentlyLiked
    ? await supabase
        .from("likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId)
    : await supabase
        .from("likes")
        .insert({ post_id: postId, user_id: userId });

  assertNoError(result.error);
}

export async function setPostSaved(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
  currentlySaved: boolean
) {
  const result = currentlySaved
    ? await supabase
        .from("saved_posts")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId)
    : await supabase
        .from("saved_posts")
        .insert({ post_id: postId, user_id: userId });

  assertNoError(result.error);
}

export async function createPostComment(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
  body: string
) {
  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    user_id: userId,
    body: body.trim(),
  });

  assertNoError(error);
}

export async function setReelLike(
  supabase: SupabaseClient,
  userId: string,
  reelId: string,
  currentlyLiked: boolean
) {
  const result = currentlyLiked
    ? await supabase
        .from("reel_likes")
        .delete()
        .eq("reel_id", reelId)
        .eq("user_id", userId)
    : await supabase
        .from("reel_likes")
        .insert({ reel_id: reelId, user_id: userId });

  assertNoError(result.error);
}

export async function setReelSaved(
  supabase: SupabaseClient,
  userId: string,
  reelId: string,
  currentlySaved: boolean
) {
  const result = currentlySaved
    ? await supabase
        .from("saved_reels")
        .delete()
        .eq("reel_id", reelId)
        .eq("user_id", userId)
    : await supabase
        .from("saved_reels")
        .insert({ reel_id: reelId, user_id: userId });

  assertNoError(result.error);
}

export async function createReelComment(
  supabase: SupabaseClient,
  userId: string,
  reelId: string,
  body: string
) {
  const { error } = await supabase.from("reel_comments").insert({
    reel_id: reelId,
    user_id: userId,
    body: body.trim(),
  });

  assertNoError(error);
}

export async function removeReel(
  supabase: SupabaseClient,
  userId: string,
  reel: Reel
) {
  const { error } = await supabase
    .from("reels")
    .delete()
    .eq("id", reel.id)
    .eq("author_id", userId);

  assertNoError(error);

  await supabase.storage.from("media").remove([reel.media_path]);
}

export async function setFollowing(
  supabase: SupabaseClient,
  userId: string,
  otherUserId: string,
  currentlyFollowing: boolean
) {
  const result = currentlyFollowing
    ? await supabase
        .from("follows")
        .delete()
        .eq("follower_id", userId)
        .eq("following_id", otherUserId)
    : await supabase.from("follows").insert({
        follower_id: userId,
        following_id: otherUserId,
      });

  assertNoError(result.error);
}

export async function createMessage(
  supabase: SupabaseClient,
  userId: string,
  recipientId: string,
  body: string
): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      sender_id: userId,
      recipient_id: recipientId,
      body: body.trim(),
    })
    .select("*")
    .single();

  assertNoError(error);
  return data as Message;
}
