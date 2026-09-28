"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import EmptyState from "./empty-state";
import FeedSkeleton from "./feed-skeleton";
import PageTitle from "./page-title";
import {
  avatarFor,
  formatRelativeTime,
  initialsAvatar,
} from "../lib/profile";
import type { NotificationRow, Profile } from "../types";
import { respondPostCollaboration } from "../data/mutations";
import AvatarImage from "./avatar-image";
import UserMediaImage from "./user-media-image";
import VerifiedBadge from "./verified-badge";
import Icon from "./icon";

type ActivityEntity = {
  id: string;
  kind: "post" | "reel";
  mediaPath: string | null;
  mediaType: "image" | "video" | null;
};

type ActivityItem = NotificationRow & {
  actor?: Profile;
  entity?: ActivityEntity;
};

function notificationCopy(item: ActivityItem) {
  const contentLabel = item.entity?.kind === "reel" ? "reel" : "post";

  switch (item.type) {
    case "follow":
      return "followed you";
    case "follow_request":
      return "requested to follow you";
    case "follow_request_accepted":
      return "accepted your follow request";
    case "like":
      return "liked your " + contentLabel;
    case "comment":
      return "commented on your " + contentLabel;
    case "reply":
      return "replied to your comment";
    case "comment_like":
      return "liked your comment";
    case "message_request":
      return "sent you a message request";
    case "message_reply":
      return "replied to your message";
    case "message_reaction":
      return "reacted to your message";
    case "collab_invite":
      return "invited you to collaborate on a post";
    case "collab_accepted":
      return "accepted your post collaboration invite";
    default:
      return "sent you a message";
  }
}

function notificationHref(item: ActivityItem) {
  if (item.entity) {
    return item.entity.kind === "post"
      ? "/p/" + encodeURIComponent(item.entity.id)
      : "/reels?reel=" + encodeURIComponent(item.entity.id);
  }

  if (item.type === "follow_request") {
    return "/settings/follow-requests";
  }

  if (
    item.type === "message" ||
    item.type === "message_request" ||
    item.type === "message_reply" ||
    item.type === "message_reaction"
  ) {
    return item.actor?.username
      ? "/messages?user=" + encodeURIComponent(item.actor.username)
      : "/messages";
  }

  return item.actor?.username
    ? "/u/" + encodeURIComponent(item.actor.username)
    : "/home?screen=activity";
}

export default function ActivityPanel({
  supabase,
  userId,
  onRead,
}: {
  supabase: SupabaseClient;
  userId: string;
  onRead: () => void;
}) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [collabInvites, setCollabInvites] = useState<Array<{
    post_id: string;
    invited_by: string;
    created_at: string;
    inviter?: Profile;
  }>>([]);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setLoadError("");

      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("id,type,created_at,actor_id,entity_id,read_at")
          .eq("recipient_id", userId)
          .order("created_at", { ascending: false })
          .limit(60);

        if (error) throw error;

        const rows = (data || []) as NotificationRow[];
        const actorIds = [...new Set(rows.map((item) => item.actor_id))];
        const entityIds = [
          ...new Set(
            rows
              .filter((item) =>
                ["like", "comment", "reply", "comment_like"].includes(item.type)
              )
              .flatMap((item) => (item.entity_id ? [item.entity_id] : []))
          ),
        ];

        const [actorsResult, postsResult, reelsResult, collabResult] =
          await Promise.all([
            actorIds.length
              ? supabase
                  .from("profiles")
                  .select(
                    "id,username,display_name,bio,avatar_url,verified,created_at"
                  )
                  .in("id", actorIds)
              : Promise.resolve({ data: [], error: null }),
            entityIds.length
              ? supabase
                  .from("posts")
                  .select("id,media_path,media_type,cover_path")
                  .in("id", entityIds)
              : Promise.resolve({ data: [], error: null }),
            entityIds.length
              ? supabase
                  .from("reels")
                  .select("id,media_path,cover_path")
                  .in("id", entityIds)
              : Promise.resolve({ data: [], error: null }),
            supabase
              .from("post_collaborators")
              .select("post_id,invited_by,created_at")
              .eq("user_id", userId)
              .eq("status", "pending")
              .order("created_at", { ascending: false }),
          ]);

        if (actorsResult.error) throw actorsResult.error;
        if (postsResult.error) throw postsResult.error;
        if (reelsResult.error) throw reelsResult.error;
        if (collabResult.error) throw collabResult.error;

        const actorMap = new Map(
          ((actorsResult.data || []) as Profile[]).map((actor) => [
            actor.id,
            actor,
          ])
        );

        const entityMap = new Map<string, ActivityEntity>();

        for (const post of postsResult.data || []) {
          entityMap.set(post.id, {
            id: post.id,
            kind: "post",
            mediaPath:
              post.media_type === "image"
                ? post.media_path
                : post.cover_path || null,
            mediaType:
              post.media_type === "image" || post.media_type === "video"
                ? post.media_type
                : null,
          });
        }

        for (const reel of reelsResult.data || []) {
          entityMap.set(reel.id, {
            id: reel.id,
            kind: "reel",
            mediaPath: reel.cover_path || null,
            mediaType: "video",
          });
        }

        const nextItems: ActivityItem[] = rows.map((item) => ({
          ...item,
          actor: actorMap.get(item.actor_id),
          entity: item.entity_id ? entityMap.get(item.entity_id) : undefined,
        }));

        const collabRows = collabResult.data || [];
        const inviterIds = [...new Set(collabRows.map((row) => row.invited_by))];
        const inviterResult = inviterIds.length
          ? await supabase
              .from("profiles")
              .select(
                "id,username,display_name,bio,avatar_url,verified,created_at"
              )
              .in("id", inviterIds)
          : { data: [], error: null };

        if (inviterResult.error) throw inviterResult.error;

        const inviterMap = new Map(
          ((inviterResult.data || []) as Profile[]).map((profile) => [
            profile.id,
            profile,
          ])
        );

        if (!active) return;

        setItems(nextItems);
        setCollabInvites(
          collabRows.map((row) => ({
            ...row,
            inviter: inviterMap.get(row.invited_by),
          }))
        );

        const markRead = await supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("recipient_id", userId)
          .is("read_at", null);

        if (markRead.error) throw markRead.error;
        onRead();
      } catch {
        if (active) {
          setLoadError("Notifications could not be loaded. Please try again.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [supabase, userId, onRead]);

  async function respondCollab(postId: string, accept: boolean) {
    setBusyPostId(postId);
    try {
      await respondPostCollaboration(supabase, postId, accept);
      setCollabInvites((current) =>
        current.filter((item) => item.post_id !== postId)
      );
    } finally {
      setBusyPostId(null);
    }
  }

  return (
    <>
      <PageTitle
        eyebrow="ACTIVITY"
        title="Notifications"
        text="Likes, comments, replies, follows, requests and messages."
      />

      {collabInvites.length > 0 && (
        <section className="collab-invites" aria-label="Collaboration invites">
          <div className="collab-invites-head">
            <div>
              <small>COLLABORATIONS</small>
              <h3>Post invitations</h3>
            </div>
            <span>{collabInvites.length}</span>
          </div>

          {collabInvites.map((invite) => {
            const inviterName =
              invite.inviter?.display_name || "An AVENZO creator";

            return (
              <div className="collab-invite-row" key={invite.post_id}>
                <AvatarImage
                  src={
                    invite.inviter
                      ? avatarFor(invite.inviter)
                      : initialsAvatar(inviterName)
                  }
                  alt={inviterName}
                  size={72}
                />
                <div>
                  <b className="verified-line">
                    {inviterName}
                    <VerifiedBadge verified={invite.inviter?.verified} />
                  </b>
                  <small>invited you to collaborate on a post</small>
                </div>
                <div className="collab-invite-actions">
                  <button
                    type="button"
                    className="btn small"
                    disabled={busyPostId === invite.post_id}
                    onClick={() => void respondCollab(invite.post_id, true)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn secondary small"
                    disabled={busyPostId === invite.post_id}
                    onClick={() => void respondCollab(invite.post_id, false)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {loading ? (
        <FeedSkeleton />
      ) : loadError ? (
        <div className="activity-error" role="alert">
          <Icon name="activity" size={28} />
          <b>Could not load notifications</b>
          <span>{loadError}</span>
          <button
            type="button"
            className="btn small"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No activity yet."
          text="When people interact with you, it will appear here."
        />
      ) : (
        <div className="notification-list">
          {items.map((item) => {
            const actorName = item.actor?.display_name || "Someone";
            const username = item.actor?.username || "user";
            const href = notificationHref(item);
            const thumbnailUrl = item.entity?.mediaPath
              ? supabase.storage
                  .from("media")
                  .getPublicUrl(item.entity.mediaPath).data.publicUrl
              : "";

            return (
              <Link
                className={
                  "notification notification-link " +
                  (!item.read_at ? "unread" : "")
                }
                href={href}
                key={item.id}
              >
                <AvatarImage
                  src={
                    item.actor
                      ? avatarFor(item.actor)
                      : initialsAvatar(actorName)
                  }
                  alt={actorName}
                  size={80}
                />

                <div className="notification-copy">
                  <p>
                    <b className="verified-line">
                      @{username}
                      <VerifiedBadge verified={item.actor?.verified} />
                    </b>{" "}
                    {notificationCopy(item)}
                  </p>
                  <small>{formatRelativeTime(item.created_at)}</small>
                </div>

                {!item.read_at && (
                  <i
                    className="notification-unread-dot"
                    aria-label="Unread notification"
                  />
                )}

                {item.entity &&
                  (thumbnailUrl ? (
                    <UserMediaImage
                      src={thumbnailUrl}
                      alt={
                        item.entity.kind === "post"
                          ? "Post thumbnail"
                          : "Reel thumbnail"
                      }
                      className="notification-thumbnail"
                      loading="lazy"
                    />
                  ) : item.entity.mediaType === "video" ? (
                    <span
                      className="notification-thumbnail notification-video-placeholder"
                      aria-label="Video"
                    >
                      <Icon name="reels" size={18} />
                    </span>
                  ) : null)}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
