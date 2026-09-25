"use client";

import { useState } from "react";
import Link from "next/link";
import EmptyState from "./empty-state";
import { avatarFor, formatRelativeTime } from "../lib/profile";
import type { Post, Profile, ProfileStats, Reel } from "../types";
import AvatarImage from "./avatar-image";
import UserMediaImage from "./user-media-image";
import VerifiedBadge from "./verified-badge";
import Icon from "./icon";
import RepostsGrid from "./reposts-grid";
import TaggedPostsGrid from "./tagged-posts-grid";
import ProfileHighlightsRow from "./profile-highlights-row";

export default function ProfileView({
  profile,
  posts,
  reels,
  media,
  stats,
  onEdit,
  onCreatePost,
  onCreateReel,
  onCreateStory,
}: {
  profile: Profile;
  posts: Post[];
  reels: Reel[];
  media: (path: string) => string;
  stats: ProfileStats;
  onEdit: () => void;
  onCreatePost: () => void;
  onCreateReel: () => void;
  onCreateStory: () => void;
}) {
  const [tab, setTab] =
    useState<"posts" | "reels" | "reposts" | "tagged">("posts");
  const [shareLabel, setShareLabel] = useState("Share profile");

  async function shareProfile() {
    const url =
      window.location.origin +
      "/u/" +
      encodeURIComponent(profile.username);

    try {
      if (navigator.share) {
        await navigator.share({
          title: profile.display_name + " on AVENZO",
          text: "View @" + profile.username + " on AVENZO",
          url,
        });
        setShareLabel("Shared");
      } else {
        await navigator.clipboard.writeText(url);
        setShareLabel("Link copied");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;

      try {
        await navigator.clipboard.writeText(url);
        setShareLabel("Link copied");
      } catch {
        setShareLabel("Copy failed");
      }
    }

    window.setTimeout(() => setShareLabel("Share profile"), 1600);
  }

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <div className="profile-mobile-top" aria-label="Profile overview">
          <span className="profile-mobile-avatar-wrap">
            <AvatarImage
              src={avatarFor(profile)}
              alt={profile.display_name}
              size={180}
            />
            <button
              type="button"
              onClick={onCreateStory}
              aria-label="Add story"
            >
              <Icon name="plus" size={16} />
            </button>
          </span>
          <span className="profile-mobile-stat">
            <b>{stats.posts}</b>
            <small>Posts</small>
          </span>
          <Link className="profile-mobile-stat" href="/connections/followers">
            <b>{stats.followers}</b>
            <small>Followers</small>
          </Link>
          <Link className="profile-mobile-stat" href="/connections/following">
            <b>{stats.following}</b>
            <small>Following</small>
          </Link>
        </div>

        <AvatarImage
          className="profile-desktop-avatar"
          src={avatarFor(profile)}
          alt={profile.display_name}
          size={180}
        />

        <div className="profile-hero-copy">
          <div className="profile-title-row">
            <div className="profile-identity">
              <div className="eyebrow verified-line">
                @{profile.username}
                <VerifiedBadge verified={profile.verified} />
              </div>
              <h1>{profile.display_name}</h1>
            </div>

            <button className="btn secondary small profile-edit" onClick={onEdit}>
              Edit profile
            </button>
            <button
              className="btn secondary small profile-edit"
              type="button"
              onClick={() => void shareProfile()}
            >
              {shareLabel}
            </button>
          </div>

          <p className="profile-bio">{profile.bio || "Welcome to AVENZO."}</p>

          <div className="profile-mobile-actions" aria-label="Profile actions">
            <button type="button" onClick={onEdit}>Edit profile</button>
            <button type="button" onClick={() => void shareProfile()}>{shareLabel}</button>
            <button type="button" className="primary" onClick={onCreateStory}>Add story</button>
          </div>

          <div className="profile-stats" aria-label="Profile statistics">
            <span><b>{stats.posts}</b><small>Posts</small></span>
            <Link href="/connections/followers"><b>{stats.followers}</b><small>Followers</small></Link>
            <Link href="/connections/following"><b>{stats.following}</b><small>Following</small></Link>
          </div>

          <div className="profile-create-panel">
            <span className="profile-create-label">Create</span>
            <div className="profile-create-actions" aria-label="Create content">
              <button className="btn small" onClick={onCreatePost}>Create Post</button>
              <button className="btn secondary small" onClick={onCreateReel}>Create Reel</button>
              <button className="btn secondary small" onClick={onCreateStory}>Create Story</button>
            </div>
          </div>
        </div>
      </section>

      <ProfileHighlightsRow profileId={profile.id} own />

      <div className="profile-content-tabs" role="tablist" aria-label="Profile content">
        <button
          className={tab === "posts" ? "active" : ""}
          onClick={() => setTab("posts")}
          aria-label="Posts"
        >
          <Icon name="grid" size={20} />
          <span className="profile-tab-label">Posts</span>
          <span className="profile-tab-count">{posts.length}</span>
        </button>
        <button
          className={tab === "reels" ? "active" : ""}
          onClick={() => setTab("reels")}
          aria-label="Reels"
        >
          <Icon name="reels" size={20} />
          <span className="profile-tab-label">Reels</span>
          <span className="profile-tab-count">{reels.length}</span>
        </button>
        <button
          className={tab === "reposts" ? "active" : ""}
          onClick={() => setTab("reposts")}
          aria-label="Reposts"
        >
          <Icon name="repost" size={20} />
          <span className="profile-tab-label">Reposts</span>
        </button>
        <button
          className={tab === "tagged" ? "active" : ""}
          onClick={() => setTab("tagged")}
          aria-label="Tagged"
        >
          <Icon name="tag" size={20} />
          <span className="profile-tab-label">Tagged</span>
        </button>
      </div>

      {tab === "posts" ? (
        <section className="profile-content-section" aria-labelledby="profile-posts-title">
          <div className="profile-section-head">
            <div>
              <div className="eyebrow">CONTENT</div>
              <h2 id="profile-posts-title">Posts</h2>
            </div>
            <span className="profile-section-count">{stats.posts}</span>
          </div>

          {posts.length > 0 ? (
            <div className="profile-grid">
              {posts.map((post) => {
                if (!post.media_path) {
                  return (
                    <article className="profile-text-post" key={post.id}>
                      <span>TEXT POST</span>
                      <p>{post.caption}</p>
                      <small>{formatRelativeTime(post.created_at)}</small>
                    </article>
                  );
                }

                return post.media_type === "video" ? (
                  <video
                    key={post.id}
                    src={media(post.media_path)}
                    preload="metadata"
                    controls
                    muted
                    playsInline
                  />
                ) : (
                  <UserMediaImage
                    key={post.id}
                    src={media(post.media_path)}
                    alt={post.caption || "AVENZO post"}
                    width={post.media_width}
                    height={post.media_height}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No posts yet."
              text="Your profile starts empty. Publish your first real post when you’re ready."
              action={onCreatePost}
              actionLabel="Create Post"
            />
          )}
        </section>
      ) : tab === "reels" ? (
        <section className="profile-content-section" aria-labelledby="profile-reels-title">
          <div className="profile-section-head">
            <div>
              <div className="eyebrow">VIDEO</div>
              <h2 id="profile-reels-title">Reels</h2>
            </div>
            <span className="profile-section-count">{reels.length}</span>
          </div>

          {reels.length > 0 ? (
            <div className="profile-grid reel-profile-grid">
              {reels.map((reel) => (
                <Link
                  key={reel.id}
                  className="profile-reel-tile"
                  href={"/reels?reel=" + encodeURIComponent(reel.id)}
                >
                  {reel.cover_path ? (
                    <img src={media(reel.cover_path)} alt={reel.title || reel.caption || "AVENZO reel"} />
                  ) : (
                    <video
                      src={media(reel.media_path)}
                      preload="metadata"
                      muted
                      playsInline
                    />
                  )}
                  <span className="profile-reel-stats">
                    <span><Icon name="eye" size={15} />{reel.viewCount}</span>
                    <span><Icon name="heart" size={15} />{reel.likeCount}</span>
                  </span>
                  <b>{reel.title || "Reel"}</b>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No reels yet."
              text="Your reels will appear here after you upload a real vertical video."
              action={onCreateReel}
              actionLabel="Create Reel"
            />
          )}
        </section>
      ) : tab === "reposts" ? (
        <section className="profile-content-section" aria-labelledby="profile-reposts-title">
          <div className="profile-section-head">
            <div>
              <div className="eyebrow">SHARED</div>
              <h2 id="profile-reposts-title">Reposts</h2>
            </div>
          </div>
          <RepostsGrid profileId={profile.id} own />
        </section>
      ) : (
        <section className="profile-content-section" aria-labelledby="profile-tagged-title">
          <div className="profile-section-head">
            <div>
              <div className="eyebrow">MENTIONS</div>
              <h2 id="profile-tagged-title">Tagged</h2>
            </div>
          </div>
          <TaggedPostsGrid username={profile.username} />
        </section>
      )}
    </div>
  );
}
