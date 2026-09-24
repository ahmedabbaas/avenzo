export const CONTENT_MEDIA_MAX_BYTES = 25 * 1024 * 1024;

export const ALLOWED_CONTENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export type ContentMode = "post" | "reel" | "story";

export function validateContentFile(
  file: Pick<File, "type" | "size"> | null,
  mode: ContentMode
): string | null {
  if (!file) {
    if (mode === "story") return "Choose an image or video for your story.";
    if (mode === "reel") return "Reels require a video.";
    return null;
  }

  if (!ALLOWED_CONTENT_MIME_TYPES.has(file.type)) {
    return "Choose a supported image or video file.";
  }

  if (file.size > CONTENT_MEDIA_MAX_BYTES) {
    return "Media must be 25 MB or smaller.";
  }

  if (mode === "reel" && !file.type.startsWith("video/")) {
    return "Reels require a video.";
  }

  return null;
}
