import assert from "node:assert/strict";
import { test } from "node:test";
import { pauseVideo, playVideoSafely } from "../features/social/lib/video-playback.ts";

class Video extends EventTarget {
  readyState = 0;
  plays = 0;
  pauses = 0;
  rejectPlay = false;
  play() { this.plays++; return this.rejectPlay ? Promise.reject(new Error("gesture required")) : Promise.resolve(); }
  pause() { this.pauses++; }
}

test("leaving a loading clip cancels delayed playback", () => {
  const video = new Video();
  playVideoSafely(video);
  pauseVideo(video);
  video.dispatchEvent(new Event("canplay"));
  assert.equal(video.plays, 0);
});
test("repeated loading requests play once", () => {
  const video = new Video();
  playVideoSafely(video);
  playVideoSafely(video);
  video.dispatchEvent(new Event("canplay"));
  assert.equal(video.plays, 1);
});
test("ready clip starts without interrupting playback", () => {
  const video = new Video();
  video.readyState = 2;
  playVideoSafely(video);
  assert.equal(video.plays, 1);
  assert.equal(video.pauses, 0);
});
test("rejected autoplay does not create an unhandled rejection", async () => {
  const video = new Video();
  video.readyState = 2;
  video.rejectPlay = true;
  let blocked = false;
  playVideoSafely(video, () => { blocked = true; });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(video.plays, 1);
  assert.equal(blocked, true);
});
