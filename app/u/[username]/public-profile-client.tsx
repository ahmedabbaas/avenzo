"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "../../../lib/supabase/client";

type PublicProfile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  created_at?: string;
};

type PublicPost = {
  id: string;
  caption: string;
  media_path: string | null;
  media_type: "image" | "video" | null;
  created_at: string;
  media_url: string;
};

type Stats = {
  posts: number;
  followers: number;
  following: number;
};

function fallbackAvatar(name: string) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "A";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="80" fill="#151a1e"/><text x="80" y="93" text-anchor="middle" font-family="Arial" font-size="48" font-weight="700" fill="#f6f7f8">${initials}</text></svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export default function PublicProfileClient({
  viewerId,
  profile,
  posts,
  initialFollowing,
  stats: initialStats,
}: {
  viewerId: string;
  profile: PublicProfile;
  posts: PublicPost[];
  initialFollowing: boolean;
  stats: Stats;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [stats, setStats] = useState(initialStats);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const supabase = createClient();

  async function toggleFollow() {
    if (busy) return;
    setBusy(true);
    setNotice("");

    const nextFollowing = !following;
    setFollowing(nextFollowing);
    setStats((current) => ({
      ...current,
      followers: Math.max(0, current.followers + (nextFollowing ? 1 : -1)),
    }));

    const result = following
      ? await supabase
          .from("follows")
          .delete()
          .eq("follower_id", viewerId)
          .eq("following_id", profile.id)
      : await supabase.from("follows").insert({
          follower_id: viewerId,
          following_id: profile.id,
        });

    if (result.error) {
      setFollowing(!nextFollowing);
      setStats((current) => ({
        ...current,
        followers: Math.max(0, current.followers + (nextFollowing ? -1 : 1)),
      }));
      setNotice("Could not update follow right now.");
    }

    setBusy(false);
  }

  const avatar = profile.avatar_url || fallbackAvatar(profile.display_name);
  const mediaPosts = posts.filter((post) => post.media_path);

  return (
    <main className="public-profile-shell">
      <header className="public-profile-top">
        <Link className="public-brand" href="/home">
          <i />
          AVENZO
        </Link>
        <Link className="btn secondary small" href="/home">
          Back to feed
        </Link>
      </header>

      <section className="public-profile-wrap">
        <div className="public-profile-hero">
          <img src={avatar} alt="" />

          <div className="public-profile-copy">
            <div className="eyebrow">@{profile.username}</div>
            <h1>{profile.display_name}</h1>
            <p>{profile.bio || "New to AVENZO."}</p>

            <div className="public-profile-stats">
              <span>
                <b>{stats.posts}</b>
                posts
              </span>
              <span>
                <b>{stats.followers}</b>
                followers
              </span>
              <span>
                <b>{stats.following}</b>
                following
              </span>
            </div>

            <div className="public-profile-actions">
              <button className="btn" disabled={busy} onClick={toggleFollow}>
                {following ? "Following" : "Follow"}
              </button>
              <Link
                className="btn secondary"
                href={"/home?chat=" + encodeURIComponent(profile.username)}
              >
                Message
              </Link>
            </div>

            {notice && <small className="public-profile-notice">{notice}</small>}
          </div>
        </div>

        <div className="public-profile-section-title">
          <div>
            <div className="eyebrow">POSTS</div>
            <h2>Shared by @{profile.username}</h2>
          </div>
        </div>

        {mediaPosts.length > 0 ? (
          <div className="public-profile-grid">
            {mediaPosts.map((post) =>
              post.media_type === "video" ? (
                <video
                  key={post.id}
                  src={post.media_url}
                  controls
                  muted
                  preload="metadata"
                />
              ) : (
                <img
                  key={post.id}
                  src={post.media_url}
                  alt={post.caption || "AVENZO post"}
                  loading="lazy"
                />
              )
            )}
          </div>
        ) : (
          <div className="empty">
            <span className="empty-mark">A</span>
            <b>No media posts yet.</b>
            <p>This profile’s photo and video posts will appear here.</p>
          </div>
        )}
      </section>
    </main>
  );
}
