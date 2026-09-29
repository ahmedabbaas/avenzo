"use client";

import Link from "next/link";
import type { Post, Reel } from "../types";
import UserMediaImage from "./user-media-image";
import VerifiedBadge from "./verified-badge";
import Icon from "./icon";

type ExploreMediaGridProps = {
  posts: Post[];
  reels: Reel[];
  mediaUrl: (path: string) => string;
};

type ExploreItem =
  | { kind: "post"; createdAt: string; post: Post }
  | { kind: "reel"; createdAt: string; reel: Reel };

function formatExploreMetric(value: number) {
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(".0", "") + "M";
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(value >= 100_000 ? 0 : 1).replace(".0", "") + "K";
  }
  return String(value);
}

export default function ExploreMediaGrid({
  posts,
  reels,
  mediaUrl,
}: ExploreMediaGridProps) {
  const items: ExploreItem[] = [
    ...posts.map((post) => ({
      kind: "post" as const,
      createdAt: post.created_at,
      post,
    })),
    ...reels.map((reel) => ({
      kind: "reel" as const,
      createdAt: reel.created_at,
      reel,
    })),
  ].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (!items.length) return null;

  return (
    <div className="explore-media-grid" aria-label="Explore media">
      {items.map((item) => {
        const content = item.kind === "post" ? item.post : item.reel;
        const profile = content.profile;
        const profileHref = profile
          ? "/u/" + encodeURIComponent(profile.username)
          : "/home?screen=explore";
        const contentHref =
          item.kind === "post"
            ? "/p/" + encodeURIComponent(item.post.id)
            : "/reels?reel=" + encodeURIComponent(item.reel.id);

        const isPost = item.kind === "post";
        const mediaPath = isPost
          ? item.post.media_path
          : item.reel.cover_path || item.reel.media_path;
        const isVideo =
          isPost
            ? item.post.media_type === "video"
            : !item.reel.cover_path;

        return (
          <article
            className={
              "explore-media-tile " +
              (item.kind === "reel" ? "explore-media-tile--reel" : "")
            }
            key={item.kind + "-" + content.id}
          >
            <Link
              className="explore-media-open"
              href={contentHref}
              aria-label={
                item.kind === "post" ? "Open post" : "Open reel"
              }
            >
              {mediaPath ? (
                isVideo ? (
                  <video
                    src={mediaUrl(mediaPath)}
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <UserMediaImage
                    src={mediaUrl(mediaPath)}
                    alt={
                      item.kind === "post"
                        ? item.post.caption || "AVENZO post"
                        : item.reel.title || item.reel.caption || "AVENZO reel"
                    }
                    width={isPost ? item.post.media_width : item.reel.media_width}
                    height={isPost ? item.post.media_height : item.reel.media_height}
                  />
                )
              ) : (
                <span className="explore-text-tile">
                  {item.kind === "post"
                    ? item.post.caption || "Text post"
                    : item.reel.caption || "Reel"}
                </span>
              )}

              <span className="explore-media-type">
                {item.kind === "reel" ? "REEL" : isVideo ? "VIDEO" : "POST"}
              </span>

              <span
                className="explore-media-type-mobile"
                style={{ display: "none" }}
                aria-hidden="true"
              >
                {item.kind === "reel" || isVideo ? (
                  <Icon name="play" size={16} />
                ) : item.kind === "post" &&
                  (item.post.mediaItems?.length || 0) > 1 ? (
                  <Icon name="grid" size={15} />
                ) : (
                  <Icon name="camera" size={15} />
                )}
              </span>

              <span
                className="explore-media-metric"
                style={{ display: "none" }}
              >
                <Icon
                  name={item.kind === "reel" ? "eye" : "heartModern"}
                  size={14}
                />
                <b>
                  {formatExploreMetric(
                    item.kind === "reel"
                      ? item.reel.viewCount
                      : item.post.likeCount
                  )}
                </b>
              </span>
            </Link>

            {profile && (
              <Link
                className="explore-media-author"
                href={profileHref}
                aria-label={"Open @" + profile.username}
              >
                <span>@{profile.username}</span>
                <VerifiedBadge verified={profile.verified} />
              </Link>
            )}
          </article>
        );
      })}
    </div>
  );
}
