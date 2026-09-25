import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../../../lib/supabase/config";
import { optimizeImageForUpload, type MediaDimensions } from "../lib/media";
import {
  validateContentFile,
  validateCoverFile,
  validateVerticalReelDimensions,
} from "../lib/upload-validation";
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

type UploadProgress = (percent: number) => void;

function cleanTokenList(value: string, prefix: "#" | "@") {
  const valid = prefix === "#"
    ? /^[a-z0-9_]{1,50}$/
    : /^[a-z0-9._]{3,30}$/;

  return [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((item) => item.trim().replace(/^[@#]+/, "").toLowerCase())
        .filter((item) => valid.test(item))
    ),
  ].slice(0, 30);
}

async function uploadObjectWithProgress({
  supabase,
  path,
  file,
  onProgress,
}: {
  supabase: SupabaseClient;
  path: string;
  file: File;
  onProgress?: UploadProgress;
}) {
  if (typeof XMLHttpRequest === "undefined") {
    const { error } = await supabase.storage.from("media").upload(path, file, {
      upsert: false,
      contentType: file.type,
    });
    assertNoError(error);
    onProgress?.(100);
    return;
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  assertNoError(sessionError);
  if (!session?.access_token) throw new Error("Your session expired. Sign in again.");

  await new Promise<void>((resolve, reject) => {
    const encodedPath = path
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
    const request = new XMLHttpRequest();

    request.open(
      "POST",
      SUPABASE_URL + "/storage/v1/object/media/" + encodedPath
    );
    request.setRequestHeader(
      "Authorization",
      "Bearer " + session.access_token
    );
    request.setRequestHeader("apikey", SUPABASE_PUBLISHABLE_KEY);
    request.setRequestHeader("x-upsert", "false");
    request.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream"
    );

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(
        Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)))
      );
    };

    request.onerror = () => reject(new Error("Upload connection failed."));
    request.onabort = () => reject(new Error("Upload was cancelled."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }

      let detail = "Upload failed.";
      try {
        const parsed = JSON.parse(request.responseText || "{}");
        detail = parsed.message || parsed.error || detail;
      } catch {
        // Keep the safe generic message.
      }
      reject(new Error(detail));
    };

    request.send(file);
  });
}

async function uploadContentMedia({
  supabase,
  userId,
  mode,
  file,
  folderSuffix = "",
  onProgress,
}: {
  supabase: SupabaseClient;
  userId: string;
  mode: CreateMode;
  file: File;
  folderSuffix?: string;
  onProgress?: UploadProgress;
}) {
  const baseFolder =
    mode === "reel" ? "reels" : mode === "story" ? "stories" : "posts";
  const folder = folderSuffix
    ? baseFolder + "/" + folderSuffix
    : baseFolder;

  const path =
    userId +
    "/" +
    folder +
    "/" +
    crypto.randomUUID() +
    "." +
    safeExtension(file);

  await uploadObjectWithProgress({
    supabase,
    path,
    file,
    onProgress,
  });

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
  postMedia = [],
  title = "",
  hashtags = "",
  mentions = "",
  location = "",
  coverFile = null,
  highQualityUploads = true,
  onProgress,
}: {
  supabase: SupabaseClient;
  userId: string;
  mode: CreateMode;
  caption: string;
  file: File | null;
  dimensions: MediaDimensions | null;
  postMedia?: Array<{
    file: File;
    dimensions: MediaDimensions | null;
  }>;
  title?: string;
  hashtags?: string;
  mentions?: string;
  location?: string;
  coverFile?: File | null;
  highQualityUploads?: boolean;
  onProgress?: UploadProgress;
}) {
  const normalizedPostMedia =
    mode === "post"
      ? (
          postMedia.length
            ? postMedia
            : file
              ? [{ file, dimensions }]
              : []
        ).slice(0, 10)
      : [];

  if (mode === "post") {
    if (postMedia.length > 10) {
      throw new Error("A carousel can contain up to 10 images.");
    }

    for (const item of normalizedPostMedia) {
      const itemError = validateContentFile(item.file, "post");
      if (itemError) throw new Error(itemError);
    }
  } else {
    const validationError = validateContentFile(file, mode);
    if (validationError) throw new Error(validationError);
  }

  const coverError = validateCoverFile(coverFile);
  if (coverError) throw new Error(coverError);

  if (mode === "reel") {
    const verticalError = validateVerticalReelDimensions(dimensions);
    if (verticalError) throw new Error(verticalError);
  }

  const cleanHashtags = cleanTokenList(hashtags, "#");
  const cleanMentions = cleanTokenList(mentions, "@");
  const cleanLocation = location.trim().slice(0, 160);
  const cleanCaption = caption.trim().slice(0, 2200);
  const cleanTitle = title.trim().slice(0, 120);

  let uploadedPath: string | null = null;
  let uploadedCoverPath: string | null = null;
  let mediaType: "image" | "video" | null = null;
  let insertedPostId: string | null = null;
  const uploadedPaths: string[] = [];
  const uploadedPostItems: Array<{
    media_path: string;
    media_width: number | null;
    media_height: number | null;
    position: number;
  }> = [];

  try {
    if (mode === "post") {
      const totalItems = Math.max(1, normalizedPostMedia.length);

      for (let index = 0; index < normalizedPostMedia.length; index += 1) {
        const item = normalizedPostMedia[index];
        const preparedFile = await optimizeImageForUpload(
          item.file,
          highQualityUploads
        );

        const uploaded = await uploadContentMedia({
          supabase,
          userId,
          mode,
          file: preparedFile,
          onProgress: (percent) => {
            const base = (index / totalItems) * 92;
            const slice = (percent / 100) * (92 / totalItems);
            onProgress?.(Math.round(base + slice));
          },
        });

        uploadedPaths.push(uploaded.path);
        uploadedPostItems.push({
          media_path: uploaded.path,
          media_width: item.dimensions?.width || null,
          media_height: item.dimensions?.height || null,
          position: index,
        });
      }

      const first = uploadedPostItems[0] || null;
      uploadedPath = first?.media_path || null;
      mediaType = first ? "image" : null;

      const postResult = await supabase
        .from("posts")
        .insert({
          author_id: userId,
          caption: cleanCaption,
          hashtags: cleanHashtags,
          mentions: cleanMentions,
          location: cleanLocation,
          media_path: uploadedPath,
          media_type: mediaType,
          cover_path: null,
          media_width: first?.media_width || null,
          media_height: first?.media_height || null,
        })
        .select("id")
        .single();

      assertNoError(postResult.error);
      if (!postResult.data?.id) {
        throw new Error("Post could not be created.");
      }
      insertedPostId = postResult.data.id;

      if (uploadedPostItems.length) {
        const mediaResult = await supabase
          .from("post_media_items")
          .insert(
            uploadedPostItems.map((item) => ({
              post_id: insertedPostId,
              media_path: item.media_path,
              media_type: "image",
              media_width: item.media_width,
              media_height: item.media_height,
              position: item.position,
            }))
          );

        assertNoError(mediaResult.error);
      }

      onProgress?.(100);
      return;
    }

    const usesCover = Boolean(coverFile && file?.type.startsWith("video/"));
    const mainProgressEnd = usesCover ? 82 : 100;

    if (file) {
      const preparedFile = await optimizeImageForUpload(
        file,
        highQualityUploads
      );

      const uploaded = await uploadContentMedia({
        supabase,
        userId,
        mode,
        file: preparedFile,
        onProgress: (percent) =>
          onProgress?.(Math.round((percent / 100) * mainProgressEnd)),
      });

      uploadedPath = uploaded.path;
      uploadedPaths.push(uploaded.path);
      mediaType = uploaded.type;
    }

    if (usesCover && coverFile) {
      const preparedCover = await optimizeImageForUpload(
        coverFile,
        highQualityUploads
      );
      const cover = await uploadContentMedia({
        supabase,
        userId,
        mode,
        file: preparedCover,
        folderSuffix: "covers",
        onProgress: (percent) =>
          onProgress?.(
            mainProgressEnd +
              Math.round((percent / 100) * (100 - mainProgressEnd))
          ),
      });
      uploadedCoverPath = cover.path;
      uploadedPaths.push(cover.path);
    }

    if (mode === "story") {
      const { error } = await supabase.from("stories").insert({
        author_id: userId,
        caption: cleanCaption,
        hashtags: cleanHashtags,
        mentions: cleanMentions,
        location: cleanLocation,
        media_path: uploadedPath,
        media_type: mediaType,
        cover_path: uploadedCoverPath,
        media_width: dimensions?.width || null,
        media_height: dimensions?.height || null,
      });

      assertNoError(error);
      onProgress?.(100);
      return;
    }

    const { error } = await supabase.from("reels").insert({
      author_id: userId,
      title: cleanTitle,
      caption: cleanCaption,
      hashtags: cleanHashtags,
      mentions: cleanMentions,
      location: cleanLocation,
      media_path: uploadedPath,
      media_type: "video",
      cover_path: uploadedCoverPath,
      media_width: dimensions?.width || null,
      media_height: dimensions?.height || null,
    });

    assertNoError(error);
    onProgress?.(100);
  } catch (error) {
    if (insertedPostId) {
      await supabase
        .from("posts")
        .delete()
        .eq("id", insertedPostId)
        .eq("author_id", userId);
    }

    const paths = [...new Set([
      ...uploadedPaths,
      uploadedPath,
      uploadedCoverPath,
    ].filter((path): path is string => Boolean(path)))];

    if (paths.length) {
      await supabase.storage.from("media").remove(paths);
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

  const mediaPaths = [
    post.media_path,
    post.cover_path,
    ...(post.mediaItems || []).map((item) => item.media_path),
  ].filter((path): path is string => Boolean(path));
  if (mediaPaths.length) {
    await supabase.storage.from("media").remove(mediaPaths);
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

export async function recordReelView(
  supabase: SupabaseClient,
  reelId: string
) {
  const { data, error } = await supabase.rpc("record_reel_view", {
    target_reel: reelId,
  });
  assertNoError(error);
  return Number(data || 0);
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

  const mediaPaths = [reel.media_path, reel.cover_path].filter(
    (path): path is string => Boolean(path)
  );
  if (mediaPaths.length) {
    await supabase.storage.from("media").remove(mediaPaths);
  }
}

export async function setFollowing(
  supabase: SupabaseClient,
  _userId: string,
  otherUserId: string,
  currentlyFollowingOrRequested: boolean
): Promise<"none" | "requested" | "following"> {
  const rpc = currentlyFollowingOrRequested
    ? "unfollow_or_cancel_request"
    : "request_or_follow_user";

  const { data, error } = await supabase.rpc(rpc, {
    target_user: otherUserId,
  });

  assertNoError(error);

  const state = String(data || "none");
  return state === "following"
    ? "following"
    : state === "requested"
      ? "requested"
      : "none";
}

export async function setPostReposted(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
  currentlyReposted: boolean
) {
  const result = currentlyReposted
    ? await supabase
        .from("reposts")
        .delete()
        .eq("user_id", userId)
        .eq("post_id", postId)
    : await supabase.from("reposts").insert({
        user_id: userId,
        post_id: postId,
        reel_id: null,
      });

  assertNoError(result.error);
}

export async function setReelReposted(
  supabase: SupabaseClient,
  userId: string,
  reelId: string,
  currentlyReposted: boolean
) {
  const result = currentlyReposted
    ? await supabase
        .from("reposts")
        .delete()
        .eq("user_id", userId)
        .eq("reel_id", reelId)
    : await supabase.from("reposts").insert({
        user_id: userId,
        post_id: null,
        reel_id: reelId,
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
