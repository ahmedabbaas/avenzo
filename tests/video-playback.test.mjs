import assert from "node:assert/strict";
import { test } from "node:test";
import { pauseVideo, playVideoSafely, observeFeedVideo } from "../features/social/lib/video-playback.ts";

class Video extends EventTarget {
  readyState = 0;
  plays = 0;
  pauses = 0;
  rejectPlay = false;
  paused = true;
  play() {
    this.plays++;
    if (this.rejectPlay) return Promise.reject(new Error("gesture required"));
    const changed = this.paused;
    this.paused = false;
    if (changed) this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  }
  pause() {
    this.pauses++;
    const changed = !this.paused;
    this.paused = true;
    if (changed) this.dispatchEvent(new Event("pause"));
  }
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

test("feed playback stops offscreen, on hidden tabs and after cleanup", () => {
  const originalDocument = globalThis.document;
  const originalObserver = globalThis.IntersectionObserver;
  const page = new EventTarget();
  page.hidden = false;
  let observe;
  let disconnected = false;
  globalThis.document = page;
  globalThis.IntersectionObserver = class {
    constructor(callback) { observe = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  };
  try {
    const video = new Video();
    const cleanup = observeFeedVideo(video, true);
    assert.equal(video.plays, 0);
    observe([{ target: video, isIntersecting: true, intersectionRatio: .8 }]);
    // Leaving before the media loads cancels the deferred play request.
    observe([{ target: video, isIntersecting: false, intersectionRatio: 0 }]);
    video.dispatchEvent(new Event("canplay"));
    assert.equal(video.plays, 0);
    video.readyState = 2;
    observe([{ target: video, isIntersecting: true, intersectionRatio: .8 }]);
    assert.equal(video.plays, 1);
    video.paused = true;
    video.dispatchEvent(new Event("pause"));
    page.hidden = true;
    page.dispatchEvent(new Event("visibilitychange"));
    const pauses = video.pauses;
    assert.ok(pauses > 0);
    page.hidden = false;
    page.dispatchEvent(new Event("visibilitychange"));
    assert.equal(video.plays, 1, "manual pause must survive leaving and returning to the tab");
    cleanup();
    assert.equal(disconnected, true);
    page.hidden = false;
    page.dispatchEvent(new Event("visibilitychange"));
    observe([{ target: video, isIntersecting: true, intersectionRatio: 1 }]);
    assert.equal(video.plays, 1);
  } finally {
    globalThis.document = originalDocument;
    globalThis.IntersectionObserver = originalObserver;
  }
});

test("manual and data-saving feed clips never autoplay on intersection", () => {
  const originalDocument = globalThis.document;
  const originalObserver = globalThis.IntersectionObserver;
  let observe;
  globalThis.document = new EventTarget();
  globalThis.IntersectionObserver = class {
    constructor(callback) { observe = callback; }
    observe() {}
    disconnect() {}
  };
  try {
    const video = new Video();
    video.readyState = 2;
    const cleanup = observeFeedVideo(video, false);
    observe([{ target: video, isIntersecting: true, intersectionRatio: 1 }]);
    assert.equal(video.plays, 0);
    cleanup();
  } finally {
    globalThis.document = originalDocument;
    globalThis.IntersectionObserver = originalObserver;
  }
});
