// A delayed play request must never revive a clip after it leaves the viewport.
const pending = new WeakMap<HTMLVideoElement, () => void>();

export function pauseVideo(video: HTMLVideoElement) {
  const listener = pending.get(video);
  if (listener) video.removeEventListener("canplay", listener);
  pending.delete(video);
  video.pause();
}

export function playVideoSafely(video: HTMLVideoElement, onBlocked?: () => void) {
  const listener = pending.get(video);
  if (listener) video.removeEventListener("canplay", listener);
  pending.delete(video);
  if (typeof document !== "undefined" && document.hidden) return;
  const start = () => {
    pending.delete(video);
    if (typeof document !== "undefined" && document.hidden) return;
    void video.play().catch(() => onBlocked?.());
  };
  if (video.readyState >= 2) start();
  else {
    pending.set(video, start);
    video.addEventListener("canplay", start, { once: true });
  }
}

/** Feed clips play only when mostly visible and stop when the tab or card leaves. */
export function observeFeedVideo(video: HTMLVideoElement, autoplay: boolean) {
  let visible = false;
  let disposed = false;
  let manuallyPaused = false;
  let automaticPause = false;
  const onPause = () => {
    if (automaticPause) automaticPause = false;
    else manuallyPaused = true;
  };
  const onPlay = () => { manuallyPaused = false; automaticPause = false; };
  const sync = () => {
    if (disposed) return;
    if (!visible || document.hidden) {
      if (!video.paused) automaticPause = true;
      pauseVideo(video);
    } else if (autoplay && !manuallyPaused) playVideoSafely(video);
  };
  const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(
    (entries) => {
      const entry = entries.find(item => item.target === video);
      if (!entry) return;
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.6;
      sync();
    },
    { threshold: [0, 0.6, 1] },
  );
  // Unsupported observers keep native playback controls; never auto-play blindly.
  observer?.observe(video);
  document.addEventListener("visibilitychange", sync);
  video.addEventListener("pause", onPause);
  video.addEventListener("play", onPlay);
  return () => {
    disposed = true;
    observer?.disconnect();
    document.removeEventListener("visibilitychange", sync);
    video.removeEventListener("pause", onPause);
    video.removeEventListener("play", onPlay);
    pauseVideo(video);
  };
}
