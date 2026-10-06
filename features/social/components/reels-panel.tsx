"use client";

import Link from "next/link";
import { playVideoSafely, pauseVideo } from "../lib/video-playback";
import { useRuntimePreferences } from "../../settings/lib/runtime-preferences";
import BrandLogo from "../../../components/brand-logo";
import MobileBottomNav from "../../../components/mobile-bottom-nav";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import {
  createReelComment,
  recordReelView,
  setReelLike,
  setReelReposted,
  setReelSaved,
  setFollowing,
} from "../data/mutations";
import { fetchFollowingState, fetchReels } from "../data/queries";
import type { Profile, Reel } from "../types";
import AvatarImage from "./avatar-image";
import EmptyState from "./empty-state";
import { ReelsSkeleton } from "./loading-skeletons";
import Icon from "./icon";
import { avatarFor, formatRelativeTime } from "../lib/profile";

function formatReelMetric(value: number) {
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(".0", "") + "M";
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(value >= 100_000 ? 0 : 1).replace(".0", "") + "K";
  }
  return String(value);
}

export default function ReelsPanel({
  currentUser,
  initialReelId = "",
}: {
  currentUser: Profile;
  initialReelId?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const preferences = useRuntimePreferences();
  const saveData = preferences.data_saving_mode || preferences.use_less_mobile_data;
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewedRef = useRef(new Set<string>());
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const lastLoadAtRef = useRef(0);

  const [reels, setReels] = useState<Reel[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [followed, setFollowed] = useState<string[]>([]);
  const [requested, setRequested] = useState<string[]>([]);
  const [reelTab, setReelTab] = useState<
    "for-you" | "following" | "trending" | "music" | "gaming" | "travel"
  >("for-you");
  const [loading, setLoading] = useState(true);
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [manualPaused, setManualPaused] = useState(!preferences.media_autoplay_videos);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());

  const mediaUrl = useCallback(
    (path: string) =>
      supabase.storage.from("media").getPublicUrl(path).data.publicUrl,
    [supabase]
  );

  const displayedReels = useMemo(() => {
    const categoryMatches = (reel: Reel, category: "music" | "gaming" | "travel") => {
      const text = [
        reel.title,
        reel.caption,
        reel.location,
        ...(reel.hashtags || []),
        ...(reel.mentions || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (category === "music") {
        return /(^|\s|#)(music|song|audio|singer|singing|beat|remix)(\s|$)/i.test(text);
      }
      if (category === "gaming") {
        return /(^|\s|#)(gaming|game|gamer|games|playstation|xbox|pcgaming|esports)(\s|$)/i.test(text);
      }
      return /(^|\s|#)(travel|trip|tour|vacation|nature|city|karachi|islamabad|lahore)(\s|$)/i.test(text);
    };

    if (reelTab === "following") {
      return reels.filter((reel) => followed.includes(reel.author_id));
    }

    if (reelTab === "trending") {
      return [...reels].sort((a, b) => {
        const scoreA =
          a.viewCount + a.likeCount * 6 + a.commentCount * 10 + a.shareCount * 12;
        const scoreB =
          b.viewCount + b.likeCount * 6 + b.commentCount * 10 + b.shareCount * 12;
        return scoreB - scoreA;
      });
    }

    if (reelTab === "music" || reelTab === "gaming" || reelTab === "travel") {
      return reels.filter((reel) => categoryMatches(reel, reelTab));
    }

    return reels;
  }, [followed, reelTab, reels]);

  const reelOrder = displayedReels.map(reel => reel.id).join(",");

  const load = useCallback(async () => {
    try {
      const [result, relationships] = await Promise.all([
        fetchReels(supabase, currentUser.id, { limit: 32 }),
        fetchFollowingState(supabase, currentUser.id),
      ]);
      setReels(result.reels);
      setSaved(result.savedReels);
      setFollowed(relationships.followed);
      setRequested(relationships.requested);
      setNotice("");
      lastLoadAtRef.current = Date.now();
    } catch {
      setNotice("Reels could not be loaded right now.");
    } finally {
      setLoading(false);
    }
  }, [supabase, currentUser.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const handleFocus = () => {
      if (Date.now() - lastLoadAtRef.current > 60_000) {
        void load();
        return;
      }

      const activeReel = displayedReels[activeIndex];
      const video = activeReel ? videoRefs.current.get(activeReel.id) : null;
      if (video && !manualPaused) {
        video.muted = muted;
        playVideoSafely(video, () => setManualPaused(true));
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [activeIndex, displayedReels, load, manualPaused, muted]);

  useEffect(() => {
    const syncPlaybackWithVisibility = () => {
      if (document.hidden) {
        for (const video of videoRefs.current.values()) {
          pauseVideo(video);
        }
        return;
      }

      const activeReel = displayedReels[activeIndex];
      const video = activeReel ? videoRefs.current.get(activeReel.id) : null;
      if (video && !manualPaused) {
        video.muted = muted;
        playVideoSafely(video, () => setManualPaused(true));
      }
    };

    document.addEventListener("visibilitychange", syncPlaybackWithVisibility);
    window.addEventListener("pageshow", syncPlaybackWithVisibility);
    return () => {
      document.removeEventListener(
        "visibilitychange",
        syncPlaybackWithVisibility
      );
      window.removeEventListener("pageshow", syncPlaybackWithVisibility);
    };
  }, [activeIndex, displayedReels, manualPaused, muted]);

  useEffect(() => {
    const channel = supabase
      .channel("reels-live-metrics")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reels" },
        (payload) => {
          const next = payload.new as {
            id?: string;
            view_count?: number | string;
            share_count?: number | string;
            save_count?: number | string;
          };
          if (!next.id) return;

          setReels((current) =>
            current.map((item) =>
              item.id === next.id
                ? {
                    ...item,
                    viewCount: Number(next.view_count ?? item.viewCount),
                    shareCount: Number(next.share_count ?? item.shareCount),
                    saveCount: Number(next.save_count ?? item.saveCount),
                  }
                : item
            )
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    if (!initialReelId || loading || displayedReels.length === 0) return;
    const index = displayedReels.findIndex((reel) => reel.id === initialReelId);
    if (index < 0) return;
    const frame = window.requestAnimationFrame(() => setActiveIndex(index));
    const target = document.querySelector<HTMLElement>(
      '[data-reel-id="' + CSS.escape(initialReelId) + '"]'
    );
    target?.scrollIntoView({ block: "start" });
    return () => window.cancelAnimationFrame(frame);
  }, [displayedReels, initialReelId, loading]);

  useEffect(() => {
    const root = viewportRef.current;
    if (!root || displayedReels.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.72) continue;
          const slide = entry.target as HTMLElement;
          const index = Number(slide.dataset.reelIndex || 0);
          const reelId = slide.dataset.reelId;
          setActiveIndex(index);
          setManualPaused(!preferences.media_autoplay_videos);

          if (reelId && !viewedRef.current.has(reelId)) {
            viewedRef.current.add(reelId);
            void recordReelView(supabase, reelId)
              .then((count) => {
                setReels((current) =>
                  current.map((item) =>
                    item.id === reelId ? { ...item, viewCount: count } : item
                  )
                );
              })
              .catch(() => viewedRef.current.delete(reelId));
          }
        }
      },
      { root, threshold: [0.4, 0.72, 0.95] }
    );

    root.querySelectorAll<HTMLElement>("[data-reel-id]").forEach((slide) => {
      observer.observe(slide);
    });

    return () => observer.disconnect();
  }, [reelOrder, displayedReels.length, preferences.media_autoplay_videos, supabase]);

  useEffect(() => {
    // Capture mounted nodes: inline refs may be cleared before unmount cleanup.
    const mountedVideos = [...videoRefs.current.values()];
    return () => mountedVideos.forEach(pauseVideo);
  }, [activeIndex, reelOrder, saveData]);

  useEffect(() => {
    for (const [reelId, video] of videoRefs.current.entries()) {
      const index = displayedReels.findIndex((reel) => reel.id === reelId);
      const active = index === activeIndex;
      video.muted = muted;
      if (!active || manualPaused || document.hidden) {
        pauseVideo(video);
      } else {
        playVideoSafely(video, () => setManualPaused(true));
      }
    }
  }, [activeIndex, displayedReels, loadedIds, manualPaused, muted]);

  useEffect(() => {
    const videos = videoRefs.current;
    return () => {
      for (const video of videos.values()) {
        pauseVideo(video);
        video.removeAttribute("src");
        video.load();
      }
      videos.clear();
    };
  }, []);

  function changeReelTab(
    next: "for-you" | "following" | "trending" | "music" | "gaming" | "travel"
  ) {
    setReelTab(next);
    setActiveIndex(0);
    setManualPaused(!preferences.media_autoplay_videos);
    window.requestAnimationFrame(() => {
      viewportRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
  }

  async function toggleAuthorFollow(reel: Reel) {
    const author = reel.profile;
    if (!author || author.id === currentUser.id) return;

    const activeRelationship =
      followed.includes(author.id) || requested.includes(author.id);

    try {
      const nextState = await setFollowing(
        supabase,
        currentUser.id,
        author.id,
        activeRelationship
      );

      setFollowed((current) =>
        nextState === "following"
          ? current.includes(author.id)
            ? current
            : [...current, author.id]
          : current.filter((id) => id !== author.id)
      );
      setRequested((current) =>
        nextState === "requested"
          ? current.includes(author.id)
            ? current
            : [...current, author.id]
          : current.filter((id) => id !== author.id)
      );
    } catch {
      setNotice("Could not update follow status.");
    }
  }

  async function toggleLike(reel: Reel) {
    const nextLiked = !reel.liked;
    setReels((current) =>
      current.map((item) =>
        item.id === reel.id
          ? {
              ...item,
              liked: nextLiked,
              likeCount: Math.max(0, item.likeCount + (nextLiked ? 1 : -1)),
            }
          : item
      )
    );

    try {
      await setReelLike(supabase, currentUser.id, reel.id, reel.liked);
    } catch {
      await load();
    }
  }

  async function toggleSave(reel: Reel) {
    const isSaved = saved.includes(reel.id);
    setSaved((current) =>
      isSaved ? current.filter((id) => id !== reel.id) : [...current, reel.id]
    );
    setReels((current) =>
      current.map((item) =>
        item.id === reel.id
          ? {
              ...item,
              saveCount: Math.max(0, item.saveCount + (isSaved ? -1 : 1)),
            }
          : item
      )
    );

    try {
      await setReelSaved(supabase, currentUser.id, reel.id, isSaved);
    } catch {
      await load();
    }
  }

  async function toggleRepost(reel: Reel) {
    const wasReposted = Boolean(reel.reposted);
    setReels((current) =>
      current.map((item) =>
        item.id === reel.id ? { ...item, reposted: !wasReposted } : item
      )
    );

    try {
      await setReelReposted(supabase, currentUser.id, reel.id, wasReposted);
      setNotice(wasReposted ? "Repost removed." : "Reposted.");
    } catch {
      setNotice("Could not update repost.");
      await load();
    }
  }

  async function addComment(reel: Reel) {
    const clean = comment.trim();
    if (!clean) return;
    setComment("");

    try {
      await createReelComment(supabase, currentUser.id, reel.id, clean);
      await load();
    } catch {
      setNotice("Comment could not be posted.");
    }
  }

  function togglePlayback(reel: Reel, index: number) {
    if (index !== activeIndex) return;
    const video = videoRefs.current.get(reel.id);
    if (!video) return;

    if (video.paused) {
      setManualPaused(false);
      playVideoSafely(video, () => setManualPaused(true));
    } else {
      pauseVideo(video);
      setManualPaused(true);
    }
  }

  function registerVideo(reelId: string, node: HTMLVideoElement | null) {
    if (node) {
      videoRefs.current.set(reelId, node);
      node.muted = muted;
      node.playsInline = true;

      return;
    }

    // React can clear an inline ref during an ordinary re-render. Mutating the
    // previous video element here used to reset its src while it was loading,
    // which left Android WebView reels stuck on "Preparing video…".
    videoRefs.current.delete(reelId);
  }

  if (loading) {
    return <ReelsSkeleton />;
  }

  return (
    <main className="reels-page">
      <div className="avenzo-mobile-reels-head" style={{ display: "none" }}>
        <b>AVENZO</b>
        <div>
          <button
            type="button"
            onClick={() => router.push("/home?screen=explore")}
            aria-label="Search AVENZO"
          >
            <Icon name="search" size={21} />
          </button>
          <button
            type="button"
            onClick={() => router.push("/home?screen=home&create=reel")}
            aria-label="Create reel"
          >
            <Icon name="camera" size={21} />
          </button>
        </div>
      </div>

      <div
        className="avenzo-mobile-reels-tabs"
        style={{ display: "none" }}
        role="tablist"
        aria-label="Reel categories"
      >
        {([
          ["for-you", "For You"],
          ["following", "Following"],
          ["trending", "Trending"],
          ["music", "Music"],
          ["gaming", "Gaming"],
          ["travel", "Travel"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={reelTab === id ? "active" : ""}
            onClick={() => changeReelTab(id)}
            role="tab"
            aria-selected={reelTab === id}
          >
            {label}
          </button>
        ))}
      </div>

      <header className="reels-topbar">
        <Link href="/home" className="messages-brand">
          <BrandLogo size={32} /><b>AVENZO</b>
        </Link>
        <div>
          <b>Reels</b>
          <span>Vertical videos from real AVENZO accounts</span>
        </div>
        <Link className="btn small" href="/home?create=reel">
          <Icon name="plus" size={16} />
          Upload Reel
        </Link>
      </header>

      {notice && <div className="reels-notice" role="alert">
        <span>{notice}</span>
        <button type="button" className="btn small" onClick={() => void load()}>Retry</button>
      </div>}

      {displayedReels.length === 0 ? (
        <div className="reels-empty-wrap">
          <EmptyState
            title={reelTab === "for-you" ? "No reels yet." : "No reels in this category."}
            text={
              reelTab === "for-you"
                ? "Upload the first vertical video and it will appear here."
                : "Real AVENZO reels matching this category will appear here."
            }
          />
          <Link className="btn" href="/home?create=reel">Upload Reel</Link>
        </div>
      ) : (
        <div className="reels-viewport" ref={viewportRef}>
          {displayedReels.map((reel, index) => {
            const author = reel.profile;
            const isSaved = saved.includes(reel.id);
            const commentsOpen = commentFor === reel.id;
            const nearby = Math.abs(index - activeIndex) <= (saveData ? 0 : 1);
            const active = index === activeIndex;
            const loaded = loadedIds.has(reel.id);
            const failed = failedIds.has(reel.id);
            const poster = reel.cover_path ? mediaUrl(reel.cover_path) : "";

            return (
              <article
                className={"reel-slide " + (active ? "active" : "")}
                key={reel.id}
                data-reel-id={reel.id}
                data-reel-index={index}
              >
                {nearby ? (
                  <video
                    ref={(node) => registerVideo(reel.id, node)}
                    className="reel-slide-video"
                    src={mediaUrl(reel.media_path)}
                    poster={poster || undefined}
                    muted={muted}
                    playsInline
                    loop
                    autoPlay={active && !manualPaused}
                    preload={active ? "auto" : "metadata"}
                    onClick={() => togglePlayback(reel, index)}
                    onLoadedMetadata={(event) => {
                      if (index === activeIndex && !manualPaused) {
                        event.currentTarget.muted = muted;
                        playVideoSafely(event.currentTarget, () => setManualPaused(true));
                      }
                    }}
                    onLoadedData={() => {
                      setLoadedIds((current) => new Set(current).add(reel.id));
                      setFailedIds((current) => {
                        const next = new Set(current);
                        next.delete(reel.id);
                        return next;
                      });
                    }}
                    onCanPlay={(event) => {
                      setLoadedIds((current) => new Set(current).add(reel.id));
                      if (index === activeIndex && !manualPaused) {
                        event.currentTarget.muted = muted;
                        playVideoSafely(event.currentTarget, () => setManualPaused(true));
                      }
                    }}
                    onPlaying={() =>
                      setLoadedIds((current) => new Set(current).add(reel.id))
                    }
                    onError={() =>
                      setFailedIds((current) => new Set(current).add(reel.id))
                    }
                  />
                ) : (
                  <div
                    className="reel-slide-placeholder"
                    style={poster ? { backgroundImage: `url("${poster}")` } : undefined}
                    aria-label="Video thumbnail"
                  />
                )}

                {!loaded && nearby && !failed && (
                  <div className="reel-video-loading" aria-hidden="true">
                    {poster ? <span>Loading video…</span> : <span>Preparing video…</span>}
                  </div>
                )}

                {failed && (
                  <div className="reel-video-error" role="alert">
                    <Icon name="reels" size={28} />
                    <b>Video failed to load</b>
                    <span>Check your connection and try again.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFailedIds((current) => {
                          const next = new Set(current);
                          next.delete(reel.id);
                          return next;
                        });
                        const video = videoRefs.current.get(reel.id);
                        video?.load();
                      }}
                    >
                      Retry
                    </button>
                  </div>
                )}

                {active && !failed && (
                  <div className="reel-playback-controls">
                    <button
                      type="button"
                      onClick={() => togglePlayback(reel, index)}
                      aria-label={manualPaused ? "Play reel" : "Pause reel"}
                    >
                      <Icon name={manualPaused ? "play" : "pause"} size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMuted((current) => !current)}
                      aria-label={muted ? "Unmute reel" : "Mute reel"}
                    >
                      <Icon name={muted ? "mute" : "volume"} size={20} />
                    </button>
                  </div>
                )}

                <div className="reel-gradient" />

                <div className="reel-overlay">
                  <div className="reel-overlay-copy">
                    {author && (
                      <>
                        <Link
                          className="reel-author"
                          href={"/u/" + encodeURIComponent(author.username)}
                        >
                          <AvatarImage
                            src={avatarFor(author)}
                            alt={author.display_name}
                            size={72}
                          />
                          <span>
                            <b>{author.display_name}</b>
                            <small >
                              @{author.username}
                              {" · "}{formatRelativeTime(reel.created_at)}
                            </small>
                          </span>
                        </Link>

                        <div
                          className="reel-mobile-author-row"
                          style={{ display: "none" }}
                        >
                          <Link
                            href={"/u/" + encodeURIComponent(author.username)}
                            className="reel-mobile-author"
                          >
                            <AvatarImage
                              src={avatarFor(author)}
                              alt={author.display_name}
                              size={68}
                            />
                            <b >
                              {author.username}
                            </b>
                          </Link>
                          {author.id !== currentUser.id && (
                            <button
                              type="button"
                              className={
                                "reel-follow-button " +
                                (followed.includes(author.id) ||
                                requested.includes(author.id)
                                  ? "active"
                                  : "")
                              }
                              onClick={() => void toggleAuthorFollow(reel)}
                            >
                              {followed.includes(author.id)
                                ? "Following"
                                : requested.includes(author.id)
                                  ? "Requested"
                                  : "Follow"}
                            </button>
                          )}
                        </div>
                      </>
                    )}

                    {reel.title && <h2>{reel.title}</h2>}
                    {reel.caption && <p>{reel.caption}</p>}

                    {(reel.hashtags.length > 0 || reel.mentions.length > 0) && (
                      <div className="reel-tags">
                        {reel.hashtags.map((tag) => <span key={"#" + tag}>#{tag}</span>)}
                        {reel.mentions.map((mention) => <span key={"@" + mention}>@{mention}</span>)}
                      </div>
                    )}

                    {reel.location && (
                      <small className="reel-location">⌖ {reel.location}</small>
                    )}
                  </div>

                  <div className="reel-actions-rail">
                    {author && (
                      <div className="reel-rail-author" style={{ display: "none" }}>
                        <Link
                          href={"/u/" + encodeURIComponent(author.username)}
                          aria-label={"Open @" + author.username}
                        >
                          <AvatarImage
                            src={avatarFor(author)}
                            alt=""
                            size={54}
                          />
                        </Link>
                        {author.id !== currentUser.id &&
                          !followed.includes(author.id) &&
                          !requested.includes(author.id) && (
                            <button
                              type="button"
                              onClick={() => void toggleAuthorFollow(reel)}
                              aria-label={"Follow @" + author.username}
                            >
                              +
                            </button>
                          )}
                      </div>
                    )}
                    <span className="reel-metric reel-view-metric" title="Views">
                      <Icon name="eye" size={22} />
                      <b>{reel.viewCount}</b>
                    </span>
                    <button
                      className={reel.liked ? "active" : ""}
                      onClick={() => void toggleLike(reel)}
                      aria-label={reel.liked ? "Unlike reel" : "Like reel"}
                    >
                      <span className="reel-action-icon-desktop">
                        <Icon name="heart" size={24} />
                      </span>
                      <span className="reel-action-icon-mobile" style={{ display: "none" }}>
                        <Icon name="heartModern" size={25} />
                      </span>
                      <b className="reel-count-desktop">{reel.likeCount}</b>
                      <b className="reel-count-mobile" style={{ display: "none" }}>
                        {formatReelMetric(reel.likeCount)}
                      </b>
                    </button>
                    <button
                      onClick={() => setCommentFor(commentsOpen ? null : reel.id)}
                      aria-label="Show comments"
                    >
                      <span className="reel-action-icon-desktop">
                        <Icon name="comment" size={24} />
                      </span>
                      <span className="reel-action-icon-mobile" style={{ display: "none" }}>
                        <Icon name="commentModern" size={25} />
                      </span>
                      <b className="reel-count-desktop">{reel.commentCount}</b>
                      <b className="reel-count-mobile" style={{ display: "none" }}>
                        {formatReelMetric(reel.commentCount)}
                      </b>
                    </button>
                    <button
                      onClick={() =>
                        router.push("/messages?shareReel=" + encodeURIComponent(reel.id))
                      }
                      aria-label="Share reel"
                    >
                      <span className="reel-action-icon-desktop">
                        <Icon name="send" size={24} />
                      </span>
                      <span className="reel-action-icon-mobile" style={{ display: "none" }}>
                        <Icon name="shareModern" size={25} />
                      </span>
                      <b className="reel-count-desktop">{reel.shareCount}</b>
                      <b className="reel-count-mobile" style={{ display: "none" }}>
                        {formatReelMetric(reel.shareCount)}
                      </b>
                    </button>
                    <button
                      className={reel.reposted ? "active" : ""}
                      onClick={() => void toggleRepost(reel)}
                      aria-label={reel.reposted ? "Undo repost" : "Repost reel"}
                    >
                      <span className="reel-action-icon-desktop">
                        <Icon name="repost" size={24} />
                      </span>
                      <span className="reel-action-icon-mobile" style={{ display: "none" }}>
                        <Icon name="repostModern" size={25} />
                      </span>
                    </button>
                    <button
                      className={isSaved ? "active" : ""}
                      onClick={() => void toggleSave(reel)}
                      aria-label={isSaved ? "Remove saved reel" : "Save reel"}
                    >
                      <span className="reel-action-icon-desktop">
                        <Icon name="bookmark" size={24} />
                      </span>
                      <span className="reel-action-icon-mobile" style={{ display: "none" }}>
                        <Icon name="bookmarkModern" size={25} />
                      </span>
                      <b className="reel-count-desktop">{reel.saveCount}</b>
                      <b className="reel-count-mobile" style={{ display: "none" }}>
                        {formatReelMetric(reel.saveCount)}
                      </b>
                    </button>
                  </div>
                </div>

                {commentsOpen && (
                  <aside className="reel-comments-drawer">
                    <div className="reel-comments-head">
                      <b>Comments</b>
                      <button
                        onClick={() => setCommentFor(null)}
                        aria-label="Close comments"
                      >
                        <Icon name="close" size={18} />
                      </button>
                    </div>
                    <div className="reel-comments-list">
                      {reel.comments.length === 0 ? (
                        <p>No comments yet.</p>
                      ) : (
                        reel.comments.map((item) => (
                          <div key={item.id}>
                            <b >
                              {item.profile
                                ? "@" + item.profile.username
                                : "Account unavailable"}
                            </b>
                            <span>{item.body}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void addComment(reel);
                      }}
                    >
                      <input
                        value={comment}
                        onChange={(event) =>
                          setComment(event.target.value.slice(0, 1000))
                        }
                        placeholder="Add a comment…"
                      />
                      <button disabled={!comment.trim()}>Post</button>
                    </form>
                  </aside>
                )}
              </article>
            );
          })}
        </div>
      )}

      <MobileBottomNav
        active="reels"
        onHome={() => router.push("/home?screen=home")}
        onSearch={() => router.push("/home?screen=explore")}
        onCreate={destination => router.push("/home?screen=home&create=" + destination)}
        onReels={() => viewportRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
        onProfile={() => router.push("/home?screen=profile")}
        profileAvatarUrl={avatarFor(currentUser)}
      />
    </main>
  );
}
