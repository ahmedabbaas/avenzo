export const CONTENT_MEDIA_MAX_BYTES = 25 * 1024 * 1024;
export const COVER_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const ALLOWED_CONTENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export const ALLOWED_COVER_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type ContentMode = "post" | "reel" | "story";

export function validateContentFile(
  file: Pick<File, "type" | "size"> | null,
  mode: ContentMode
): string | null {
  if (!file) {
    if (mode === "post") return "Posts require an image.";
    if (mode === "story") return "Choose an image or video for your story.";
    if (mode === "reel") return "Reels require a vertical video.";
    return null;
  }

  if (!ALLOWED_CONTENT_MIME_TYPES.has(file.type)) {
    return "Choose a supported image or video file.";
  }

  if (file.size > CONTENT_MEDIA_MAX_BYTES) {
    return "Media must be 25 MB or smaller.";
  }

  if (mode === "post" && !file.type.startsWith("image/")) {
    return "Posts support images only. Upload videos as Reels.";
  }

  if (mode === "reel" && !file.type.startsWith("video/")) {
    return "Reels require a video.";
  }

  return null;
}

export function validateCoverFile(
  file: Pick<File, "type" | "size"> | null
): string | null {
  if (!file) return null;

  if (!ALLOWED_COVER_MIME_TYPES.has(file.type)) {
    return "Cover image must be JPEG, PNG or WebP.";
  }

  if (file.size > COVER_IMAGE_MAX_BYTES) {
    return "Cover image must be 10 MB or smaller.";
  }

  return null;
}

export function validateVerticalReelDimensions(
  dimensions: { width: number; height: number } | null
): string | null {
  if (!dimensions) return null;
  if (dimensions.height <= dimensions.width) {
    return "Reels must use a vertical video (portrait orientation).";
  }
  return null;
}
