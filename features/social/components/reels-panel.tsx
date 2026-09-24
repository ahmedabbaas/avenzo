"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import {
  createReelComment,
  recordReelView,
  setReelLike,
  setReelSaved,
} from "../data/mutations";
import { fetchReels } from "../data/queries";
import type { Profile, Reel } from "../types";
import AvatarImage from "./avatar-image";
import EmptyState from "./empty-state";
import Icon from "./icon";
import VerifiedBadge from "./verified-badge";
import { avatarFor, formatRelativeTime } from "../lib/profile";

export default function ReelsPanel({
  currentUser,
  initialReelId = "",
}: {
  currentUser: Profile;
  initialReelId?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewedRef = useRef(new Set<string>());
  const [reels, setReels] = useState<Reel[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState("");

  const mediaUrl = useCallback(
    (path: string) =>
      supabase.storage.from("media").getPublicUrl(path).data.publicUrl,
    [supabase]
  );

  const load = useCallback(async () => {
    try {
      const result = await fetchReels(supabase, currentUser.id, { limit: 100 });
      setReels(result.reels);
      setSaved(result.savedReels);
    } catch {
      setNotice("Reels could not be loaded right now.");
    } finally {
      setLoading(false);
    }
  }, [supabase, currentUser.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const handleFocus = () => void load();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("reels-live-metrics")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reels",
        },
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
    if (!initialReelId || loading) return;
    const target = document.querySelector<HTMLElement>(
      '[data-reel-id="' + CSS.escape(initialReelId) + '"]'
    );
    target?.scrollIntoView({ block: "start" });
  }, [initialReelId, loading]);

  useEffect(() => {
    const root = viewportRef.current;
    if (!root || reels.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const slide = entry.target as HTMLElement;
          const video = slide.querySelector("video");
          const reelId = slide.dataset.reelId;
          if (!video || !reelId) continue;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.72) {
            root.querySelectorAll("video").forEach((candidate) => {
              if (candidate !== video) candidate.pause();
            });
            void video.play().catch(() => undefined);

            if (!viewedRef.current.has(reelId)) {
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
          } else {
            video.pause();
          }
        }
      },
      { root, threshold: [0.35, 0.72, 0.9] }
    );

    root.querySelectorAll<HTMLElement>("[data-reel-id]").forEach((slide) => {
      observer.observe(slide);
    });

    return () => observer.disconnect();
  }, [reels.length, supabase]);

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

  if (loading) {
    return (
      <main className="reels-page">
        <header className="reels-topbar">
          <Link href="/home" className="messages-brand">
            <span>A</span><b>AVENZO</b>
          </Link>
        </header>
        <div className="reels-loading">Loading reels…</div>
      </main>
    );
  }

  return (
    <main className="reels-page">
      <header className="reels-topbar">
        <Link href="/home" className="messages-brand">
          <span>A</span><b>AVENZO</b>
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

      {notice && <div className="reels-notice">{notice}</div>}

      {reels.length === 0 ? (
        <div className="reels-empty-wrap">
          <EmptyState
            title="No reels yet."
            text="Upload the first vertical video and it will appear here."
          />
          <Link className="btn" href="/home?create=reel">Upload Reel</Link>
        </div>
      ) : (
        <div className="reels-viewport" ref={viewportRef}>
          {reels.map((reel) => {
            const author = reel.profile;
            const isSaved = saved.includes(reel.id);
            const commentsOpen = commentFor === reel.id;
            return (
              <article
                className="reel-slide"
                key={reel.id}
                data-reel-id={reel.id}
              >
                <video
                  className="reel-slide-video"
                  src={mediaUrl(reel.media_path)}
                  poster={reel.cover_path ? mediaUrl(reel.cover_path) : undefined}
                  muted
                  playsInline
                  loop
                  preload="metadata"
                  controls
                />

                <div className="reel-gradient" />

                <div className="reel-overlay">
                  <div className="reel-overlay-copy">
                    {author && (
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
                          <small className="verified-line">
                            @{author.username}
                            <VerifiedBadge verified={author.verified} />
                            {" · "}{formatRelativeTime(reel.created_at)}
                          </small>
                        </span>
                      </Link>
                    )}

                    {reel.title && <h2>{reel.title}</h2>}
                    {reel.caption && <p>{reel.caption}</p>}

                    {(reel.hashtags.length > 0 || reel.mentions.length > 0) && (
                      <div className="reel-tags">
                        {reel.hashtags.map((tag) => <span key={"#"+tag}>#{tag}</span>)}
                        {reel.mentions.map((mention) => <span key={"@"+mention}>@{mention}</span>)}
                      </div>
                    )}

                    {reel.location && <small className="reel-location">⌖ {reel.location}</small>}
                  </div>

                  <div className="reel-actions-rail">
                    <span className="reel-metric" title="Views">
                      <Icon name="eye" size={22} />
                      <b>{reel.viewCount}</b>
                    </span>
                    <button
                      className={reel.liked ? "active" : ""}
                      onClick={() => void toggleLike(reel)}
                      aria-label={reel.liked ? "Unlike reel" : "Like reel"}
                    >
                      <Icon name="heart" size={24} />
                      <b>{reel.likeCount}</b>
                    </button>
                    <button
                      onClick={() => setCommentFor(commentsOpen ? null : reel.id)}
                      aria-label="Show comments"
                    >
                      <Icon name="comment" size={24} />
                      <b>{reel.commentCount}</b>
                    </button>
                    <button
                      onClick={() =>
                        router.push("/messages?shareReel=" + encodeURIComponent(reel.id))
                      }
                      aria-label="Share reel"
                    >
                      <Icon name="send" size={24} />
                      <b>{reel.shareCount}</b>
                    </button>
                    <button
                      className={isSaved ? "active" : ""}
                      onClick={() => void toggleSave(reel)}
                      aria-label={isSaved ? "Remove saved reel" : "Save reel"}
                    >
                      <Icon name="bookmark" size={24} />
                      <b>{reel.saveCount}</b>
                    </button>
                  </div>
                </div>

                {commentsOpen && (
                  <aside className="reel-comments-drawer">
                    <div className="reel-comments-head">
                      <b>Comments</b>
                      <button onClick={() => setCommentFor(null)} aria-label="Close comments">
                        <Icon name="close" size={18} />
                      </button>
                    </div>
                    <div className="reel-comments-list">
                      {reel.comments.length === 0 ? (
                        <p>No comments yet.</p>
                      ) : (
                        reel.comments.map((item) => (
                          <div key={item.id}>
                            <b className="verified-line">
                              @{item.profile?.username || "user"}
                              <VerifiedBadge verified={item.profile?.verified} />
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
                        onChange={(event) => setComment(event.target.value.slice(0, 1000))}
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
    </main>
  );
}
