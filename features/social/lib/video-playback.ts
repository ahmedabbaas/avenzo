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
