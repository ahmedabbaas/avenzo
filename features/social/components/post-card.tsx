"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "./icon";
import { avatarFor, formatRelativeTime, initialsAvatar } from "../lib/profile";
import type { Post } from "../types";
import AvatarImage from "./avatar-image";
import UserMediaImage from "./user-media-image";

export default function PostCard({
  post,
  saved,
  mediaUrl,
  onLike,
  onSave,
  onShare,
  onComment,
  own,
  onDelete,
}: {
  post: Post;
  saved: boolean;
  mediaUrl: string;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  onComment: (value: string) => void;
  own: boolean;
  onDelete: () => void;
}) {
  const [comment, setComment] = useState("");
  const author = post.profile;
  const authorName = author?.display_name || "AVENZO user";

  return (
    <article className="post-card">
      <div className="post-head">
        {author ? (
          <Link
            className="person-line person-link"
            href={"/u/" + encodeURIComponent(author.username)}
          >
            <AvatarImage src={avatarFor(author)} alt={author.display_name} size={80} />
            <div>
              <b>{authorName}</b>
              <small>
                @{author.username} · {formatRelativeTime(post.created_at)}
              </small>
            </div>
          </Link>
        ) : (
          <div className="person-line">
            <AvatarImage src={initialsAvatar(authorName)} alt={authorName} size={80} />
            <div>
              <b>{authorName}</b>
              <small>@user · {formatRelativeTime(post.created_at)}</small>
            </div>
          </div>
        )}
        {own && (
          <button className="post-delete" onClick={onDelete} aria-label="Delete post">
            Delete
          </button>
        )}
      </div>

      {post.caption && <p className="post-caption">{post.caption}</p>}

      {post.media_path && post.media_type === "image" && (
        <UserMediaImage
          className="post-media"
          src={mediaUrl}
          alt={post.caption || "AVENZO post"}
          width={post.media_width}
          height={post.media_height}
        />
      )}

      {post.media_path && post.media_type === "video" && (
        <video
          className="post-media"
          src={mediaUrl}
          controls
          preload="metadata"
          playsInline
        />
      )}

      <div className="post-content">
        <div className="post-actions">
          <button
            className={post.liked ? "liked" : ""}
            onClick={onLike}
            aria-label={post.liked ? "Unlike post" : "Like post"}
          >
            <Icon name="heart" size={20} />
            <span>{post.likeCount}</span>
          </button>

          <span className="post-stat">
            <Icon name="comment" size={20} />
            <span>{post.commentCount}</span>
          </span>

          <button
            onClick={onShare}
            aria-label="Share post"
          >
            <Icon name="send" size={20} />
          </button>

          <button
            className={"save-action " + (saved ? "saved" : "")}
            onClick={onSave}
            aria-label={saved ? "Remove from saved" : "Save post"}
          >
            <Icon name="bookmark" size={20} />
          </button>
        </div>

        {post.comments.length > 0 && (
          <div className="comment-list">
            {post.comments.slice(-3).map((item) => (
              <div key={item.id}>
                <b>@{item.profile?.username || "user"}</b>
                <span>{item.body}</span>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!comment.trim()) return;
            onComment(comment);
            setComment("");
          }}
          className="comment-input"
        >
          <input
            value={comment}
            onChange={(event) => setComment(event.target.value.slice(0, 1000))}
            placeholder="Add a comment…"
            aria-label="Add a comment"
          />
          <button disabled={!comment.trim()}>Post</button>
        </form>
      </div>
    </article>
  );
}

