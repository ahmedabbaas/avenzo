"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Icon from "./icon";
import { avatarFor, formatRelativeTime, initialsAvatar } from "../lib/profile";
import type { Comment, Post, Profile } from "../types";
import AvatarImage from "./avatar-image";
import UserMediaImage from "./user-media-image";
import VerifiedBadge from "./verified-badge";
import { nativeImpact, shareExternal } from "../lib/native-social";

function renderCommentBody(body: string) {
  const parts = body.split(/(@[a-zA-Z0-9._-]{1,30})/g);

  return parts.map((part, index) => {
    if (/^@[a-zA-Z0-9._-]{1,30}$/.test(part)) {
      const username = part.slice(1);
      return (
        <Link
          className="comment-mention"
          href={"/u/" + encodeURIComponent(username)}
          key={part + "-" + index}
        >
          {part}
        </Link>
      );
    }

    return <span key={"text-" + index}>{part}</span>;
  });
}

export default function PostCard({
  post,
  saved,
  mediaUrl,
  onLike,
  onSave,
  onShare,
  onRepost,
  onPollVote,
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
  commentAvatarUrl = "",
}: {
  post: Post;
  saved: boolean;
  mediaUrl: string;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  onRepost?: () => void;
  onPollVote?: (optionId: string) => void;
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
  commentAvatarUrl?: string;
}) {
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [visibleRootCount, setVisibleRootCount] = useState(3);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [visibleReplyCounts, setVisibleReplyCounts] = useState<Record<string, number>>({});
  const commentInputRef = useRef<HTMLInputElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(post.caption || "");
  const [viewerUrl, setViewerUrl] = useState("");
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [heartBurst, setHeartBurst] = useState(false);
  const [showMobileComments, setShowMobileComments] = useState(false);
  const author = post.profile;
  const authorName = author?.display_name || "Account unavailable";
  const rootComments = post.comments.filter((item) => !item.parent_id);
  const hiddenRootCount = Math.max(0, rootComments.length - visibleRootCount);
  const visibleRootComments = rootComments.slice(hiddenRootCount);
  const participantMap = new Map<string, Profile>();

  if (author) participantMap.set(author.username.toLowerCase(), author);
  for (const item of post.comments) {
    if (item.profile) {
      participantMap.set(item.profile.username.toLowerCase(), item.profile);
    }
  }

  const mentionMatch = comment.match(/(?:^|\s)@([a-zA-Z0-9._-]*)$/);
  const mentionQuery = mentionMatch?.[1]?.toLowerCase() || "";
  const mentionSuggestions = mentionMatch
    ? [...participantMap.values()]
        .filter((profile) =>
          profile.username.toLowerCase().startsWith(mentionQuery)
        )
        .slice(0, 5)
    : [];

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

        nativeImpact("medium");
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
                <span className="post-name-verified" style={{ display: "none" }}>
                  <VerifiedBadge verified={author.verified} />
                </span>
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
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  void shareExternal({
                    title: authorName + " on AVENZO",
                    text: "Open this post on AVENZO",
                    url: window.location.origin + "/p/" + post.id,
                  });
                }}
              >
                Share outside AVENZO
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

      {post.poll && (
        <section className="post-poll" aria-label="Post poll">
          <div className="post-poll-head">
            <div>
              <span>AVENZO POLL</span>
              <b>{post.poll.question}</b>
            </div>
            <small>
              {post.poll.closes_at ? "Timed" : "Open"}
            </small>
          </div>

          <div className="post-poll-options">
            {post.poll.options.map((option) => {
              const selected = post.poll?.selectedOptionId === option.id;
              const percent =
                post.poll && post.poll.totalVotes > 0
                  ? Math.round((option.voteCount / post.poll.totalVotes) * 100)
                  : 0;
              return (
                <button
                  type="button"
                  key={option.id}
                  className={selected ? "selected" : ""}
                  disabled={!onPollVote}
                  onClick={() => {
                    nativeImpact("light");
                    onPollVote?.(option.id);
                  }}
                >
                  <i style={{ width: percent + "%" }} />
                  <span>{option.label}</span>
                  <strong>{percent}%</strong>
                </button>
              );
            })}
          </div>

          <div className="post-poll-foot">
            <span>
              {post.poll.totalVotes.toLocaleString()} vote
              {post.poll.totalVotes === 1 ? "" : "s"}
            </span>
            {post.poll.selectedOptionId && <small>Tap your choice again to remove vote.</small>}
          </div>
        </section>
      )}

      <div className="post-content">
        <div className="post-actions">
          <button
            className={post.liked ? "liked" : ""}
            onClick={onLike}
            aria-label={post.liked ? "Unlike post" : "Like post"}
          >
            <span className="post-action-icon-web">
              <Icon name="heart" size={20} />
            </span>
            <span
              className="post-action-icon-mobile"
              style={{ display: "none" }}
            >
              <Icon name="heartModern" size={21} />
            </span>
            <span>{post.likeCount}</span>
          </button>

          <span className="post-stat">
            <span className="post-action-icon-web">
              <Icon name="comment" size={20} />
            </span>
            <span
              className="post-action-icon-mobile"
              style={{ display: "none" }}
            >
              <Icon name="commentModern" size={21} />
            </span>
            <span>{post.commentCount}</span>
          </span>

          <button onClick={onShare} aria-label="Share post">
            <span className="post-action-icon-web">
              <Icon name="send" size={20} />
            </span>
            <span
              className="post-action-icon-mobile"
              style={{ display: "none" }}
            >
              <Icon name="shareModern" size={21} />
            </span>
          </button>

          {onRepost && (
            <button
              className={"repost-action " + (post.reposted ? "active" : "")}
              onClick={onRepost}
              aria-label={post.reposted ? "Undo repost" : "Repost"}
              title={post.reposted ? "Undo repost" : "Repost"}
            >
              <span className="post-action-icon-web">
                <Icon name="repost" size={20} />
              </span>
              <span
                className="post-action-icon-mobile"
                style={{ display: "none" }}
              >
                <Icon name="repostModern" size={21} />
              </span>
            </button>
          )}

          <button
            className={"save-action " + (saved ? "saved" : "")}
            onClick={onSave}
            aria-label={saved ? "Remove from saved" : "Save post"}
          >
            <span className="post-action-icon-web">
              <Icon name="bookmark" size={20} />
            </span>
            <span
              className="post-action-icon-mobile"
              style={{ display: "none" }}
            >
              <Icon name="bookmarkModern" size={21} />
            </span>
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
            <b className="post-caption-author-web">
              {author?.username ? "@" + author.username : authorName}
            </b>
            <b
              className="post-caption-author-mobile"
              style={{ display: "none" }}
            >
              {authorName}
            </b>
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

        {post.commentCount > 0 && (
          <button
            type="button"
            className="post-view-comments-mobile"
            style={{ display: "none" }}
            onClick={() => setShowMobileComments((open) => !open)}
          >
            {showMobileComments ? "Hide comments" : "View all comments"}
          </button>
        )}

        {post.comments.length > 0 && (
          <div
            className={
              "comment-list" +
              (showMobileComments ? " mobile-comments-open" : "")
            }
          >
            {hiddenRootCount > 0 && (
              <button
                type="button"
                className="comments-load-more"
                onClick={() =>
                  setVisibleRootCount((current) =>
                    Math.min(rootComments.length, current + 5)
                  )
                }
              >
                View {Math.min(5, hiddenRootCount)} more comment
                {Math.min(5, hiddenRootCount) === 1 ? "" : "s"}
                <small>{hiddenRootCount} remaining</small>
              </button>
            )}

            {visibleRootComments.map((item) => {
              const replies = post.comments.filter(
                (reply) => reply.parent_id === item.id
              );
              const repliesOpen = Boolean(expandedReplies[item.id]);
              const replyLimit = visibleReplyCounts[item.id] || 3;
              const visibleReplies = replies.slice(0, replyLimit);
              const remainingReplies = Math.max(
                0,
                replies.length - visibleReplies.length
              );

              return (
                <div className="post-comment-thread" key={item.id}>
                  <div className="post-comment-row">
                    <Link
                      className="post-comment-avatar"
                      href={
                        item.profile?.username
                          ? "/u/" + encodeURIComponent(item.profile.username)
                          : "#"
                      }
                      aria-label={
                        item.profile?.username
                          ? "Open @" + item.profile.username
                          : "Comment author"
                      }
                    >
                      <AvatarImage
                        src={
                          item.profile
                            ? avatarFor(item.profile)
                            : initialsAvatar("User")
                        }
                        alt={item.profile?.display_name || "User"}
                        size={48}
                      />
                    </Link>

                    <div className="post-comment-main">
                      <div className="post-comment-copy">
                        <p>
                          {item.profile?.username ? (
                            <Link
                              className="post-comment-username verified-line"
                              href={
                                "/u/" +
                                encodeURIComponent(item.profile.username)
                              }
                            >
                              @{item.profile.username}
                              <VerifiedBadge
                                verified={item.profile.verified}
                              />
                            </Link>
                          ) : (
                            <b>@user</b>
                          )}
                          <span>{renderCommentBody(item.body)}</span>
                        </p>
                        <small>{formatRelativeTime(item.created_at)}</small>
                      </div>

                      <div className="post-comment-tools">
                        <button
                          type="button"
                          className={item.liked ? "active" : ""}
                          onClick={() => onCommentLike(item)}
                          aria-label={item.liked ? "Unlike comment" : "Like comment"}
                        >
                          <Icon name="heart" size={13} />
                          {item.likeCount ? <span>{item.likeCount}</span> : null}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTo(item);
                            const username = item.profile?.username;
                            if (username && !comment.trim()) {
                              setComment("@" + username + " ");
                            }
                            window.requestAnimationFrame(() =>
                              commentInputRef.current?.focus()
                            );
                          }}
                        >
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
                  </div>

                  {replies.length > 0 && (
                    <button
                      type="button"
                      className="comment-replies-toggle"
                      onClick={() =>
                        setExpandedReplies((current) => ({
                          ...current,
                          [item.id]: !current[item.id],
                        }))
                      }
                    >
                      <span />
                      {repliesOpen
                        ? "Hide replies"
                        : "View " +
                          replies.length +
                          " " +
                          (replies.length === 1 ? "reply" : "replies")}
                    </button>
                  )}

                  {repliesOpen && (
                    <div className="post-comment-replies">
                      {visibleReplies.map((reply) => (
                        <div className="post-comment-reply" key={reply.id}>
                          <Link
                            className="post-comment-avatar"
                            href={
                              reply.profile?.username
                                ? "/u/" +
                                  encodeURIComponent(reply.profile.username)
                                : "#"
                            }
                            aria-label={
                              reply.profile?.username
                                ? "Open @" + reply.profile.username
                                : "Reply author"
                            }
                          >
                            <AvatarImage
                              src={
                                reply.profile
                                  ? avatarFor(reply.profile)
                                  : initialsAvatar("User")
                              }
                              alt={reply.profile?.display_name || "User"}
                              size={42}
                            />
                          </Link>

                          <div className="post-comment-main">
                            <div className="post-comment-copy">
                              <p>
                                {reply.profile?.username ? (
                                  <Link
                                    className="post-comment-username verified-line"
                                    href={
                                      "/u/" +
                                      encodeURIComponent(
                                        reply.profile.username
                                      )
                                    }
                                  >
                                    @{reply.profile.username}
                                    <VerifiedBadge
                                      verified={reply.profile.verified}
                                    />
                                  </Link>
                                ) : (
                                  <b>@user</b>
                                )}
                                <span>{renderCommentBody(reply.body)}</span>
                              </p>
                              <small>
                                {formatRelativeTime(reply.created_at)}
                              </small>
                            </div>

                            <div className="post-comment-tools">
                              <button
                                type="button"
                                className={reply.liked ? "active" : ""}
                                onClick={() => onCommentLike(reply)}
                                aria-label={
                                  reply.liked
                                    ? "Unlike reply"
                                    : "Like reply"
                                }
                              >
                                <Icon name="heart" size={12} />
                                {reply.likeCount ? (
                                  <span>{reply.likeCount}</span>
                                ) : null}
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
                        </div>
                      ))}

                      {remainingReplies > 0 && (
                        <button
                          type="button"
                          className="comments-load-more replies"
                          onClick={() =>
                            setVisibleReplyCounts((current) => ({
                              ...current,
                              [item.id]:
                                (current[item.id] || 3) + 3,
                            }))
                          }
                        >
                          View {Math.min(3, remainingReplies)} more repl
                          {Math.min(3, remainingReplies) === 1 ? "y" : "ies"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {replyTo && (
          <div className="comment-replying">
            <span>
              Replying to{" "}
              <b>@{replyTo.profile?.username || "user"}</b>
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="Cancel reply"
            >
              <Icon name="close" size={13} />
            </button>
          </div>
        )}

        {mentionSuggestions.length > 0 && (
          <div
            className="comment-mention-suggestions"
            aria-label="Mention suggestions"
          >
            {mentionSuggestions.map((profile) => (
              <button
                type="button"
                key={profile.id}
                onClick={() => {
                  setComment((current) =>
                    current.replace(
                      /(^|\s)@[a-zA-Z0-9._-]*$/,
                      "$1@" + profile.username + " "
                    )
                  );
                  window.requestAnimationFrame(() =>
                    commentInputRef.current?.focus()
                  );
                }}
              >
                <AvatarImage
                  src={avatarFor(profile)}
                  alt={profile.display_name}
                  size={38}
                />
                <span>
                  <b>@{profile.username}</b>
                  <small>{profile.display_name}</small>
                </span>
              </button>
            ))}
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
          {commentAvatarUrl && (
            <span
              className="post-comment-current-avatar"
              style={{ display: "none" }}
              aria-hidden="true"
            >
              <AvatarImage
                src={commentAvatarUrl}
                alt="Your profile"
                size={40}
              />
            </span>
          )}
          <input
            ref={commentInputRef}
            value={comment}
            onChange={(event) =>
              setComment(event.target.value.slice(0, 1000))
            }
            placeholder={replyTo ? "Write a reply…" : "Add a comment…"}
            aria-label={replyTo ? "Write a reply" : "Add a comment"}
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
          <UserMediaImage
            src={viewerUrl}
            alt={post.caption || "AVENZO post"}
            className="post-viewer-image"
            loading="eager"
          />
        </div>
      )}
    </article>
  );
}
