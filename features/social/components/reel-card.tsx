"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "./icon";
import { avatarFor, formatRelativeTime, initialsAvatar } from "../lib/profile";
import type { Reel } from "../types";
import AvatarImage from "./avatar-image";
import VerifiedBadge from "./verified-badge";

export default function ReelCard({
  reel,
  mediaUrl,
  coverUrl = "",
  saved,
  own,
  onLike,
  onSave,
  onComment,
  onShare,
  onRepost,
  onDelete,
  autoplayVideo = false,
  dataSaving = false,
}: {
  reel: Reel;
  mediaUrl: string;
  coverUrl?: string;
  saved: boolean;
  own: boolean;
  onLike: () => void;
  onSave: () => void;
  onComment: (value: string) => void;
  onShare: () => void;
  onRepost?: () => void;
  onDelete: () => void;
  autoplayVideo?: boolean;
  dataSaving?: boolean;
}) {
  const [comment, setComment] = useState("");
  const author = reel.profile;

  return (
    <article className="reel-card">
      <div className="post-head">
        {author ? (
          <Link
            className="person-line person-link"
            href={"/u/" + encodeURIComponent(author.username)}
          >
            <AvatarImage src={avatarFor(author)} alt={author.display_name} size={80} />
            <div>
              <b>{author.display_name}</b>
              <small className="verified-line">
                @{author.username}
                <VerifiedBadge verified={author.verified} />
                {" · "}{formatRelativeTime(reel.created_at)}
              </small>
            </div>
          </Link>
        ) : (
          <div className="person-line">
            <AvatarImage src={initialsAvatar("AVENZO user")} alt="AVENZO user" size={80} />
            <div>
              <b>AVENZO user</b>
              <small>{formatRelativeTime(reel.created_at)}</small>
            </div>
          </div>
        )}

        {own && (
          <button className="post-delete" onClick={onDelete}>
            Delete
          </button>
        )}
      </div>

      {reel.title && <h3 className="reel-card-title">{reel.title}</h3>}

      <video
        className="reel-media"
        src={mediaUrl}
        poster={coverUrl || undefined}
        controls
        autoPlay={autoplayVideo}
        muted={autoplayVideo}
        playsInline
        preload={dataSaving ? "none" : "metadata"}
      />

      {reel.caption && <p className="post-caption">{reel.caption}</p>}

      {(reel.hashtags.length > 0 || reel.mentions.length > 0 || reel.location) && (
        <div className="content-meta-line">
          {reel.hashtags.map((tag) => <span key={"#"+tag}>#{tag}</span>)}
          {reel.mentions.map((mention) => <span key={"@"+mention}>@{mention}</span>)}
          {reel.location && <small>⌖ {reel.location}</small>}
        </div>
      )}

      <div className="post-content">
        <div className="post-actions reel-card-actions">
          <span className="post-stat" title="Views">
            <Icon name="eye" size={20} />
            <span>{reel.viewCount}</span>
          </span>
          <button
            className={reel.liked ? "liked" : ""}
            onClick={onLike}
            aria-label={reel.liked ? "Unlike reel" : "Like reel"}
          >
            <Icon name="heart" size={20} />
            <span>{reel.likeCount}</span>
          </button>
          <span className="post-stat">
            <Icon name="comment" size={20} />
            <span>{reel.commentCount}</span>
          </span>
          <button onClick={onShare} aria-label="Share reel">
            <Icon name="send" size={20} />
            <span>{reel.shareCount}</span>
          </button>
          {onRepost && (
            <button
              className={"repost-action " + (reel.reposted ? "active" : "")}
              onClick={onRepost}
              aria-label={reel.reposted ? "Undo repost" : "Repost reel"}
              title={reel.reposted ? "Undo repost" : "Repost"}
            >
              <Icon name="repost" size={20} />
            </button>
          )}
          <button
            className={"save-action " + (saved ? "saved" : "")}
            onClick={onSave}
            aria-label={saved ? "Remove saved reel" : "Save reel"}
          >
            <Icon name="bookmark" size={20} />
            <span>{reel.saveCount}</span>
          </button>
        </div>

        {reel.comments.length > 0 && (
          <div className="comment-list">
            {reel.comments.slice(-3).map((item) => (
              <div key={item.id}>
                <b className="verified-line">
                  @{item.profile?.username || "user"}
                  <VerifiedBadge verified={item.profile?.verified} />
                </b>
                <span>{item.body}</span>
              </div>
            ))}
          </div>
        )}

        <form
          className="comment-input"
          onSubmit={(event) => {
            event.preventDefault();
            if (!comment.trim()) return;
            onComment(comment);
            setComment("");
          }}
        >
          <input
            value={comment}
            onChange={(event) => setComment(event.target.value.slice(0, 1000))}
            placeholder="Add a comment…"
            aria-label="Add a reel comment"
          />
          <button disabled={!comment.trim()}>Post</button>
        </form>

        <Link className="reel-open-link" href={"/reels?reel=" + encodeURIComponent(reel.id)}>
          Open fullscreen reel
        </Link>
      </div>
    </article>
  );
}
