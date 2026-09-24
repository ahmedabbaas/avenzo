import {
  CONTENT_MEDIA_MAX_BYTES,
  validateContentFile,
} from "../features/social/lib/upload-validation.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function fakeFile(type: string, size: number) {
  return { type, size } as Pick<File, "type" | "size">;
}

Deno.test("accepts supported post media within the size limit", () => {
  assert(
    validateContentFile(fakeFile("image/jpeg", 1024), "post") === null,
    "jpeg post should be accepted"
  );
  assert(
    validateContentFile(fakeFile("video/mp4", 1024), "post") === null,
    "mp4 post should be accepted"
  );
});

Deno.test("rejects unsupported social media MIME types", () => {
  assert(
    validateContentFile(fakeFile("application/pdf", 1024), "post") !== null,
    "pdf should be rejected"
  );
});

Deno.test("enforces the 25 MB social media limit", () => {
  assert(
    validateContentFile(
      fakeFile("image/png", CONTENT_MEDIA_MAX_BYTES + 1),
      "post"
    ) !== null,
    "oversized media should be rejected"
  );
});

Deno.test("reels require video and stories require media", () => {
  assert(
    validateContentFile(fakeFile("image/png", 1024), "reel") !== null,
    "image reel should be rejected"
  );
  assert(
    validateContentFile(fakeFile("video/webm", 1024), "reel") === null,
    "video reel should be accepted"
  );
  assert(
    validateContentFile(null, "story") !== null,
    "story without media should be rejected"
  );
});
