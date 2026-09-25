"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "./icon";
import { avatarFor, formatRelativeTime, initialsAvatar } from "../lib/profile";
import type { Post } from "../types";
import AvatarImage from "./avatar-image";
import UserMediaImage from "./user-media-image";
import VerifiedBadge from "./verified-badge";

export default function PostCard({
  post,
  saved,
  mediaUrl,
  onLike,
  onSave,
  onShare,
  onRepost,
  onComment,
  own,
  onDelete,
  autoplayVideo = false,
  dataSaving = false,
}: {
  post: Post;
  saved: boolean;
  mediaUrl: string;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  onRepost?: () => void;
  onComment: (value: string) => void;
  own: boolean;
  onDelete: () => void;
  autoplayVideo?: boolean;
  dataSaving?: boolean;
}) {
  const [comment, setComment] = useState("");
  const [carouselIndex, setCarouselIndex] = useState(0);
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
              <b className="post-author-collab">
                <span>{authorName}</span>
                {post.collaborators?.length ? (
                  <span className="post-collab-copy">
                    {" "}with{" "}
                    {post.collaborators.slice(0, 2).map((collaborator, index) => (
                      <span key={collaborator.id}>
                        {index > 0 ? ", " : ""}
                        @{collaborator.username}
                      </span>
                    ))}
                    {post.collaborators.length > 2
                      ? " +" + (post.collaborators.length - 2)
                      : ""}
                  </span>
                ) : null}
              </b>
              <small className="verified-line">
                @{author.username}
                <VerifiedBadge verified={author.verified} />
                {" · "}{formatRelativeTime(post.created_at)}
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

      {post.media_type === "image" &&
      (post.mediaItems?.length || 0) > 1 ? (
        <div className="post-carousel-shell">
          <div
            className="post-carousel-track"
            onScroll={(event) => {
              const node = event.currentTarget;
              const width = node.clientWidth || 1;
              const next = Math.round(node.scrollLeft / width);
              if (next !== carouselIndex) {
                setCarouselIndex(
                  Math.max(
                    0,
                    Math.min(next, (post.mediaItems?.length || 1) - 1)
                  )
                );
              }
            }}
          >
            {post.mediaItems?.map((item, index) => (
              <div className="post-carousel-slide" key={item.id}>
                <UserMediaImage
                  className="post-media post-carousel-media"
                  src={item.url}
                  alt={
                    item.alt_text ||
                    (post.caption
                      ? post.caption + " · image " + (index + 1)
                      : "AVENZO carousel image " + (index + 1))
                  }
                  width={item.media_width}
                  height={item.media_height}
                />
              </div>
            ))}
          </div>

          <span className="post-carousel-count" aria-live="polite">
            {carouselIndex + 1}/{post.mediaItems?.length || 1}
          </span>

          <div className="post-carousel-dots" aria-hidden="true">
            {post.mediaItems?.map((item, index) => (
              <i
                key={item.id}
                className={index === carouselIndex ? "active" : ""}
              />
            ))}
          </div>
        </div>
      ) : post.media_path && post.media_type === "image" ? (
        <UserMediaImage
          className="post-media"
          src={mediaUrl}
          alt={post.caption || "AVENZO post"}
          width={post.media_width}
          height={post.media_height}
        />
      ) : null}

      {post.media_path && post.media_type === "video" && (
        <video
          className="post-media"
          src={mediaUrl}
          controls
          autoPlay={autoplayVideo}
          muted={autoplayVideo}
          preload={dataSaving ? "none" : "metadata"}
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

          <button onClick={onShare} aria-label="Share post">
            <Icon name="send" size={20} />
          </button>

          {onRepost && (
            <button
              className={"repost-action " + (post.reposted ? "active" : "")}
              onClick={onRepost}
              aria-label={post.reposted ? "Undo repost" : "Repost"}
              title={post.reposted ? "Undo repost" : "Repost"}
            >
              <Icon name="repost" size={20} />
            </button>
          )}

          <button
            className={"save-action " + (saved ? "saved" : "")}
            onClick={onSave}
            aria-label={saved ? "Remove from saved" : "Save post"}
          >
            <Icon name="bookmark" size={20} />
          </button>
        </div>

        {post.caption && (
          <p className="post-caption post-caption-after">
            <b>{author?.username ? "@" + author.username : authorName}</b>
            <span>{post.caption}</span>
          </p>
        )}

        {(post.hashtags?.length || post.mentions?.length || post.location) && (
          <div className="content-meta-line post-meta-after">
            {post.hashtags?.map((tag) => <span key={"#"+tag}>#{tag}</span>)}
            {post.mentions?.map((mention) => <span key={"@"+mention}>@{mention}</span>)}
            {post.location && <small>⌖ {post.location}</small>}
          </div>
        )}

        {post.comments.length > 0 && (
          <div className="comment-list">
            {post.comments.slice(-3).map((item) => (
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
