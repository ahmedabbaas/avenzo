"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "./icon";
import { avatarFor, formatRelativeTime, initialsAvatar } from "../lib/profile";
import type { Comment, Post } from "../types";
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
  onCommentLike,
  onCommentDelete,
  onEditCaption,
  onReport,
  currentUserId,
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
  onComment: (value: string, parentId?: string | null) => void;
  onCommentLike: (comment: Comment) => void;
  onCommentDelete: (comment: Comment) => void;
  onEditCaption: (caption: string) => void;
  onReport: () => void;
  currentUserId: string;
  own: boolean;
  onDelete: () => void;
  autoplayVideo?: boolean;
  dataSaving?: boolean;
}) {
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(post.caption || "");
  const [viewerUrl, setViewerUrl] = useState("");
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [heartBurst, setHeartBurst] = useState(false);
  const author = post.profile;
  const authorName = author?.display_name || "Account unavailable";

  if (!author) return null;

  return (
    <article
      className="post-card"
      onDoubleClick={(event) => {
        const target = event.target as HTMLElement;
        if (
          target.closest("button") ||
          target.closest("input") ||
          target.closest("form") ||
          target.closest("a")
        ) {
          return;
        }

        if (!post.liked) onLike();
        setHeartBurst(false);
        window.requestAnimationFrame(() => {
          setHeartBurst(true);
          window.setTimeout(() => setHeartBurst(false), 620);
        });
      }}
    >
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
        <div className="post-menu-shell">
          <button
            className="post-more-button"
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Post options"
            aria-expanded={menuOpen}
          >
            <Icon name="more" size={19} />
          </button>
          {menuOpen && (
            <div className="post-menu" role="menu">
              {own && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setCaptionDraft(post.caption || "");
                    setEditingCaption(true);
                    setMenuOpen(false);
                  }}
                >
                  Edit caption
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  void navigator.clipboard?.writeText(
                    window.location.origin + "/p/" + post.id
                  );
                  setMenuOpen(false);
                }}
              >
                Copy link
              </button>
              {!own && (
                <button
                  type="button"
                  role="menuitem"
                  className="danger"
                  onClick={() => {
                    onReport();
                    setMenuOpen(false);
                  }}
                >
                  Report
                </button>
              )}
              {own && (
                <button
                  type="button"
                  role="menuitem"
                  className="danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                >
                  Delete post
                </button>
              )}
            </div>
          )}
        </div>
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
        <button
          className="post-media-open"
          type="button"
          onClick={() => setViewerUrl(mediaUrl)}
          aria-label="Open image full screen"
        >
          <UserMediaImage
            className="post-media"
            src={mediaUrl}
            alt={post.caption || "AVENZO post"}
            width={post.media_width}
            height={post.media_height}
          />
        </button>
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

      {heartBurst && (
        <span className="post-heart-burst" aria-hidden="true">
          ♥
        </span>
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

        {editingCaption ? (
          <form
            className="post-caption-editor"
            onSubmit={(event) => {
              event.preventDefault();
              onEditCaption(captionDraft);
              setEditingCaption(false);
            }}
          >
            <textarea
              value={captionDraft}
              maxLength={2200}
              rows={3}
              onChange={(event) => setCaptionDraft(event.target.value)}
              aria-label="Edit post caption"
            />
            <div>
              <button type="button" onClick={() => setEditingCaption(false)}>
                Cancel
              </button>
              <button type="submit">Save</button>
            </div>
          </form>
        ) : post.caption ? (
          <p className="post-caption post-caption-after">
            <b>{author?.username ? "@" + author.username : authorName}</b>
            <span>{post.caption}</span>
          </p>
        ) : null}

        {(post.hashtags?.length || post.mentions?.length || post.location) && (
          <div className="content-meta-line post-meta-after">
            {post.hashtags?.map((tag) => <span key={"#"+tag}>#{tag}</span>)}
            {post.mentions?.map((mention) => <span key={"@"+mention}>@{mention}</span>)}
            {post.location && <small>⌖ {post.location}</small>}
          </div>
        )}

        {post.comments.length > 0 && (
          <div className="comment-list">
            {post.comments
              .filter((item) => !item.parent_id)
              .slice(-3)
              .map((item) => (
                <div className="post-comment-thread" key={item.id}>
                  <div className="post-comment-row">
                    <div className="post-comment-copy">
                      <b className="verified-line">
                        @{item.profile?.username || "user"}
                        <VerifiedBadge verified={item.profile?.verified} />
                      </b>
                      <span>{item.body}</span>
                    </div>
                    <div className="post-comment-tools">
                      <button
                        type="button"
                        className={item.liked ? "active" : ""}
                        onClick={() => onCommentLike(item)}
                      >
                        <Icon name="heart" size={13} />
                        {item.likeCount ? <span>{item.likeCount}</span> : null}
                      </button>
                      <button type="button" onClick={() => setReplyTo(item)}>
                        Reply
                      </button>
                      {item.user_id === currentUserId && (
                        <button
                          type="button"
                          className="danger"
                          onClick={() => onCommentDelete(item)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  {post.comments
                    .filter((reply) => reply.parent_id === item.id)
                    .map((reply) => (
                      <div className="post-comment-reply" key={reply.id}>
                        <div className="post-comment-copy">
                          <b className="verified-line">
                            @{reply.profile?.username || "user"}
                            <VerifiedBadge verified={reply.profile?.verified} />
                          </b>
                          <span>{reply.body}</span>
                        </div>
                        <div className="post-comment-tools">
                          <button
                            type="button"
                            className={reply.liked ? "active" : ""}
                            onClick={() => onCommentLike(reply)}
                          >
                            <Icon name="heart" size={12} />
                            {reply.likeCount ? <span>{reply.likeCount}</span> : null}
                          </button>
                          {reply.user_id === currentUserId && (
                            <button
                              type="button"
                              className="danger"
                              onClick={() => onCommentDelete(reply)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              ))}
          </div>
        )}

        {replyTo && (
          <div className="comment-replying">
            Replying to @{replyTo.profile?.username || "user"}
            <button type="button" onClick={() => setReplyTo(null)}>×</button>
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!comment.trim()) return;
            onComment(comment, replyTo?.id || null);
            setComment("");
            setReplyTo(null);
          }}
          className="comment-input"
        >
          <input
            value={comment}
            onChange={(event) => setComment(event.target.value.slice(0, 1000))}
            placeholder={replyTo ? "Write a reply…" : "Add a comment…"}
            aria-label="Add a comment"
          />
          <button disabled={!comment.trim()}>Post</button>
        </form>
      </div>

      {viewerUrl && (
        <div
          className="post-media-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="Post image viewer"
          onClick={() => setViewerUrl("")}
        >
          <button
            type="button"
            className="post-viewer-close"
            onClick={() => setViewerUrl("")}
            aria-label="Close image viewer"
          >
            <Icon name="close" size={22} />
          </button>
          <img src={viewerUrl} alt={post.caption || "AVENZO post"} />
        </div>
      )}
    </article>
  );
}
