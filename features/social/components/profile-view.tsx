"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EmptyState from "./empty-state";
import { avatarFor, formatRelativeTime } from "../lib/profile";
import type { Post, Profile, ProfileStats, Reel } from "../types";
import ProfileHeader from "./profile-header";
import UserMediaImage from "./user-media-image";
import Icon from "./icon";
import TaggedPostsGrid from "./tagged-posts-grid";
import ProfileHighlightsRow from "./profile-highlights-row";
import ProfileSavedGrid from "./profile-saved-grid";

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
  onCreate,
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
  onCreate?: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] =
    useState<"posts" | "reels" | "saved" | "tagged">("posts");
  const [shareLabel, setShareLabel] = useState("Share Profile");
  function openProfilePost(event: MouseEvent<HTMLAnchorElement>, postId: string) {
    if (document.documentElement.classList.contains("avenzo-android-app")) {
      event.preventDefault();
      router.push("/mobile/profile-posts/" + encodeURIComponent(profile.username) + "/" + encodeURIComponent(postId));
    }
  }

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

    window.setTimeout(() => setShareLabel("Share Profile"), 1600);
  }

  return (
    <div className="profile-page">
      <ProfileHeader profile={profile} avatar={avatarFor(profile)} stats={stats}
        followersHref="/connections/followers" followingHref="/connections/following"
        onAddStory={onCreateStory}
        actions={<>
          <button type="button" className="btn" onClick={onEdit}>Edit profile</button>
          <button type="button" className="btn secondary" onClick={() => void shareProfile()}>{shareLabel}</button>
          <button type="button" className="btn secondary" onClick={() => router.push("/insights")}>Insights</button>
          <button type="button" className="icon-button profile-header-create" aria-label="Create content" onClick={onCreate || onCreatePost}><Icon name="plus" size={20} /></button>
        </>}
      />

      <ProfileHighlightsRow profileId={profile.id} own />

      <div className="profile-content-tabs" role="group" aria-label="Profile content">
        <button type="button" aria-pressed={tab === "posts"}
          className={tab === "posts" ? "active" : ""}
          onClick={() => setTab("posts")}
          aria-label="Posts"
        >
          <Icon name="grid" size={20} />
          <span className="profile-tab-label">Posts</span>
          <span className="profile-tab-count">{posts.length}</span>
        </button>
        <button type="button" aria-pressed={tab === "reels"}
          className={tab === "reels" ? "active" : ""}
          onClick={() => setTab("reels")}
          aria-label="Reels"
        >
          <Icon name="reels" size={20} />
          <span className="profile-tab-label">Reels</span>
          <span className="profile-tab-count">{reels.length}</span>
        </button>
        <button type="button" aria-pressed={tab === "saved"}
          className={tab === "saved" ? "active" : ""}
          onClick={() => setTab("saved")}
          aria-label="Saved"
        >
          <Icon name="saved" size={20} />
          <span className="profile-tab-label">Saved</span>
        </button>
        <button type="button" aria-pressed={tab === "tagged"}
          className={tab === "tagged" ? "active" : ""}
          onClick={() => setTab("tagged")}
          aria-label="Tagged"
        >
          <Icon name="tagged" size={20} />
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
              {posts.map((post) => <Link
                key={post.id}
                href={"/p/" + encodeURIComponent(post.id)}
                onClick={event => openProfilePost(event, post.id)}
                className={"profile-media-pin-wrap avenzo-mobile-profile-post" + (!post.media_path ? " profile-text-post" : "") + (post.pinned_at ? " profile-post-pinned" : "")}
                data-avenzo-post-id={post.id}
                aria-label={"Open post" + (post.caption ? ": " + post.caption.slice(0, 100) : "")}
              >
                {post.pinned_at && <i className="profile-pin-badge"><Icon name="pin" size={12} /></i>}
                {!post.media_path ? <><span>TEXT POST</span><p>{post.caption}</p><small>{formatRelativeTime(post.created_at)}</small></>
                  : post.media_type === "video" ? <><video src={media(post.media_path)} preload="none" muted playsInline /><i className="profile-pin-badge"><Icon name="play" size={16} /></i></>
                  : <UserMediaImage sizes="(max-width: 900px) 33vw, 280px" src={media(post.media_path)} alt={post.caption || "AVENZO post"} width={post.media_width} height={post.media_height} />}
              </Link>)}
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
                    <UserMediaImage
                      sizes="(max-width: 900px) 33vw, 240px"
                      src={media(reel.cover_path)}
                      alt={reel.title || reel.caption || "AVENZO reel"}
                    />
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
      ) : tab === "saved" ? (
        <section
          className="profile-content-section profile-saved-section"
          aria-label="Saved content"
        >
          <ProfileSavedGrid userId={profile.id} />
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
