"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "./icon";
import { avatarFor, formatRelativeTime, initialsAvatar } from "../lib/profile";
import type { Reel } from "../types";

export default function ReelCard({
  reel,
  mediaUrl,
  saved,
  own,
  onLike,
  onSave,
  onComment,
  onDelete,
}: {
  reel: Reel;
  mediaUrl: string;
  saved: boolean;
  own: boolean;
  onLike: () => void;
  onSave: () => void;
  onComment: (value: string) => void;
  onDelete: () => void;
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
            <img src={avatarFor(author)} alt="" />
            <div>
              <b>{author.display_name}</b>
              <small>
                @{author.username} · {formatRelativeTime(reel.created_at)}
              </small>
            </div>
          </Link>
        ) : (
          <div className="person-line">
            <img src={initialsAvatar("AVENZO user")} alt="" />
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

      <video
        className="reel-media"
        src={mediaUrl}
        controls
        playsInline
        preload="metadata"
      />

      {reel.caption && <p className="post-caption">{reel.caption}</p>}

      <div className="post-content">
        <div className="post-actions">
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

          <button
            className={"save-action " + (saved ? "saved" : "")}
            onClick={onSave}
            aria-label={saved ? "Remove saved reel" : "Save reel"}
          >
            <Icon name="bookmark" size={20} />
          </button>
        </div>

        {reel.comments.length > 0 && (
          <div className="comment-list">
            {reel.comments.slice(-3).map((item) => (
              <div key={item.id}>
                <b>@{item.profile?.username || "user"}</b>
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
      </div>
    </article>
  );
}

