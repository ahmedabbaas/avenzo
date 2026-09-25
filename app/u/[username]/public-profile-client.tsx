"use client";

import Link from "next/link";
import BrandLogo from "../../../components/brand-logo";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import AvatarImage from "../../../features/social/components/avatar-image";
import UserMediaImage from "../../../features/social/components/user-media-image";
import { initialsAvatar } from "../../../features/social/lib/profile";
import VerifiedBadge from "../../../features/social/components/verified-badge";
import RepostsGrid from "../../../features/social/components/reposts-grid";

type PublicProfile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  verified?: boolean;
  created_at?: string;
};

type PublicPost = {
  id: string;
  caption: string;
  media_path: string | null;
  media_type: "image" | "video" | null;
  media_width?: number | null;
  media_height?: number | null;
  created_at: string;
  media_url: string;
};

type PublicReel = {
  id: string;
  title: string;
  caption: string;
  media_path: string;
  cover_path: string | null;
  view_count: number | string;
  created_at: string;
  media_url: string;
  cover_url: string;
};

type Stats = {
  posts: number;
  followers: number;
  following: number;
};

type ReportReason =
  | "spam"
  | "harassment"
  | "hate"
  | "impersonation"
  | "sexual"
  | "violence"
  | "other";

export default function PublicProfileClient({
  viewerId,
  profile,
  posts,
  reels,
  initialFollowState,
  accountPrivate,
  stats: initialStats,
}: {
  viewerId: string;
  profile: PublicProfile;
  posts: PublicPost[];
  reels: PublicReel[];
  initialFollowState: "none" | "requested" | "following";
  accountPrivate: boolean;
  stats: Stats;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [followState, setFollowState] = useState(initialFollowState);
  const following = followState === "following";
  const requested = followState === "requested";
  const [contentTab, setContentTab] = useState<"posts" | "reels" | "reposts">(
    reels.length > 0 && posts.length === 0 ? "reels" : "posts"
  );
  const [reelItems, setReelItems] = useState(reels);
  const [stats, setStats] = useState(initialStats);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel("public-profile-reels-" + profile.id)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reels",
          filter: "author_id=eq." + profile.id,
        },
        (payload) => {
          const next = payload.new as {
            id?: string;
            view_count?: number | string;
            title?: string;
          };
          if (!next.id) return;

          setReelItems((current) =>
            current.map((item) =>
              item.id === next.id
                ? {
                    ...item,
                    view_count: Number(next.view_count ?? item.view_count),
                    title: next.title ?? item.title,
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
  }, [profile.id, supabase]);

  async function toggleFollow() {
    if (busy) return;

    setBusy(true);
    setNotice("");

    const previous = followState;

    const { data, error } = await supabase.rpc(
      previous === "following" || previous === "requested"
        ? "unfollow_or_cancel_request"
        : "request_or_follow_user",
      { target_user: profile.id }
    );

    if (error) {
      setNotice(
        error.message.includes("FOLLOW_NOT_ALLOWED")
          ? "This account is not accepting follows from you right now."
          : "Could not update follow right now."
      );
      setBusy(false);
      return;
    }

    const next =
      data === "following"
        ? "following"
        : data === "requested"
          ? "requested"
          : "none";

    setFollowState(next);

    const followerDelta =
      previous !== "following" && next === "following"
        ? 1
        : previous === "following" && next !== "following"
          ? -1
          : 0;

    if (followerDelta !== 0) {
      setStats((current) => ({
        ...current,
        followers: Math.max(0, current.followers + followerDelta),
      }));
    }

    if (next === "requested") {
      setNotice("Follow request sent.");
    } else if (previous === "requested" && next === "none") {
      setNotice("Follow request cancelled.");
    }

    setBusy(false);
  }

  async function blockUser() {
    const confirmed = window.confirm(
      `Block @${profile.username}? You will stop following each other and they will be hidden from your AVENZO experience.`
    );

    if (!confirmed) return;

    setBusy(true);
    setNotice("");

    const { error } = await supabase.from("blocks").insert({
      blocker_id: viewerId,
      blocked_id: profile.id,
    });

    if (error) {
      setNotice("Could not block this account right now.");
      setBusy(false);
      return;
    }

    router.replace("/home?screen=explore");
    router.refresh();
  }

  async function submitReport(event: FormEvent) {
    event.preventDefault();

    if (reporting) return;

    setReporting(true);
    setNotice("");

    const { error } = await supabase.from("reports").insert({
      reporter_id: viewerId,
      reported_user_id: profile.id,
      reason: reportReason,
      details: reportDetails.trim().slice(0, 1000),
    });

    if (error) {
      setNotice("Could not submit this report right now.");
      setReporting(false);
      return;
    }

    setShowReport(false);
    setReportDetails("");
    setReportReason("spam");
    setReporting(false);
    setNotice("Report submitted. Thank you for helping keep AVENZO safer.");
  }

  const avatar =
    profile.avatar_url || initialsAvatar(profile.display_name);
  const mediaPosts = posts.filter((post) => post.media_path);

  return (
    <main className="public-profile-shell">
      <header className="public-profile-top">
        <Link className="public-brand" href="/home">
          <BrandLogo size={34} />
          <span>AVENZO</span>
        </Link>

        <Link className="btn secondary small" href="/home">
          Back to feed
        </Link>
      </header>

      <section className="public-profile-wrap">
        <div className="public-profile-hero">
          <AvatarImage src={avatar} alt={profile.display_name} size={220} />

          <div className="public-profile-copy">
            <div className="eyebrow verified-line">@{profile.username}<VerifiedBadge verified={profile.verified} /></div>
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
              <button
                className="btn"
                disabled={busy}
                onClick={toggleFollow}
              >
                {following ? "Following" : requested ? "Requested" : "Follow"}
              </button>

              <Link
                className="btn secondary"
                href={
                  "/messages?user=" +
                  encodeURIComponent(profile.username)
                }
              >
                Message
              </Link>

              <Link
                className="btn secondary"
                href={
                  "/messages?shareProfile=" +
                  encodeURIComponent(profile.id)
                }
              >
                Share Profile
              </Link>

              <details className="profile-safety-menu">
                <summary aria-label="More profile actions">•••</summary>
                <div>
                  <button
                    type="button"
                    onClick={() => setShowReport(true)}
                  >
                    Report account
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={blockUser}
                  >
                    Block @{profile.username}
                  </button>
                </div>
              </details>
            </div>

            {notice && (
              <small className="public-profile-notice" role="status">
                {notice}
              </small>
            )}
          </div>
        </div>

        {accountPrivate && !following ? (
          <section className="public-private-account">
            <div className="public-private-lock" aria-hidden="true">🔒</div>
            <h2>This account is private</h2>
            <p>
              Follow @{profile.username} to see their posts and reels after
              they accept your request.
            </p>
            {requested && <small>Your follow request is pending.</small>}
          </section>
        ) : (
          <>
        <div className="public-profile-tabs" role="tablist" aria-label="Profile content">
          <button
            className={contentTab === "posts" ? "active" : ""}
            onClick={() => setContentTab("posts")}
          >
            Posts <span>{posts.length}</span>
          </button>
          <button
            className={contentTab === "reels" ? "active" : ""}
            onClick={() => setContentTab("reels")}
          >
            Reels <span>{reelItems.length}</span>
          </button>
          <button
            className={contentTab === "reposts" ? "active" : ""}
            onClick={() => setContentTab("reposts")}
          >
            Reposts
          </button>
        </div>

        {contentTab === "posts" ? (
          <>
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
                    <UserMediaImage
                      key={post.id}
                      src={post.media_url}
                      alt={post.caption || "AVENZO post"}
                      width={post.media_width}
                      height={post.media_height}
                    />
                  )
                )}
              </div>
            ) : (
              <div className="empty">
                <span className="empty-mark">A</span>
                <b>No media posts yet.</b>
                <p>This profile’s image posts will appear here.</p>
              </div>
            )}
          </>
        ) : contentTab === "reels" ? (
          <>
            <div className="public-profile-section-title">
              <div>
                <div className="eyebrow">REELS</div>
                <h2>Reels by @{profile.username}</h2>
              </div>
            </div>

            {reelItems.length > 0 ? (
              <div className="public-profile-grid public-reels-grid">
                {reelItems.map((reel) => (
                  <Link
                    key={reel.id}
                    className="public-reel-tile"
                    href={"/reels?reel=" + encodeURIComponent(reel.id)}
                  >
                    {reel.cover_url ? (
                      <img src={reel.cover_url} alt={reel.title || reel.caption || "AVENZO reel"} />
                    ) : (
                      <video src={reel.media_url} muted playsInline preload="metadata" />
                    )}
                    <span>{Number(reel.view_count || 0)} views</span>
                    <b>{reel.title || "Reel"}</b>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty">
                <span className="empty-mark">A</span>
                <b>No reels yet.</b>
                <p>This account has not uploaded a reel.</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="public-profile-section-title">
              <div>
                <div className="eyebrow">REPOSTS</div>
                <h2>Reposted by @{profile.username}</h2>
              </div>
            </div>
            <RepostsGrid profileId={profile.id} />
          </>
        )}
          </>
        )}
      </section>

      {showReport && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label="Report account"
        >
          <form
            className="modal-box report-modal"
            onSubmit={submitReport}
          >
            <div className="eyebrow">SAFETY</div>
            <h2>Report @{profile.username}</h2>
            <p>
              Reports are private. Choose the closest reason and add
              context if useful.
            </p>

            <label htmlFor="report-reason">Reason</label>
            <select
              id="report-reason"
              value={reportReason}
              onChange={(event) =>
                setReportReason(event.target.value as ReportReason)
              }
            >
              <option value="spam">Spam</option>
              <option value="harassment">Harassment or bullying</option>
              <option value="hate">Hateful conduct</option>
              <option value="impersonation">Impersonation</option>
              <option value="sexual">Sexual content</option>
              <option value="violence">Violence or threats</option>
              <option value="other">Something else</option>
            </select>

            <label htmlFor="report-details">
              Additional details <small>optional</small>
            </label>
            <textarea
              id="report-details"
              value={reportDetails}
              onChange={(event) =>
                setReportDetails(event.target.value.slice(0, 1000))
              }
              placeholder="Add context for the report…"
              maxLength={1000}
            />

            <div className="report-count">
              {reportDetails.length}/1000
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowReport(false)}
              >
                Cancel
              </button>
              <button className="btn" disabled={reporting}>
                {reporting ? "Submitting…" : "Submit report"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
