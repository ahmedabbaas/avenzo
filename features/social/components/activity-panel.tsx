"use client";

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
import VerifiedBadge from "./verified-badge";

export default function ActivityPanel({
  supabase,
  userId,
  onRead,
}: {
  supabase: SupabaseClient;
  userId: string;
  onRead: () => void;
}) {
  const [items, setItems] = useState<
    Array<{
      id: string;
      type:
        | "follow"
        | "follow_request"
        | "follow_request_accepted"
        | "like"
        | "comment"
        | "message"
        | "message_request"
        | "message_reply"
        | "message_reaction"
        | "collab_invite"
        | "collab_accepted";
      created_at: string;
      actor_id: string;
      actor?: Profile;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [collabInvites, setCollabInvites] = useState<Array<{
    post_id: string;
    invited_by: string;
    created_at: string;
    inviter?: Profile;
  }>>([]);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data } = await supabase
        .from("notifications")
        .select("id,type,created_at,actor_id")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(40);

      const rows = (data || []) as NotificationRow[];
      const actorIds = [...new Set(rows.map((item) => item.actor_id))];

      const { data: actors } = actorIds.length
        ? await supabase
            .from("profiles")
            .select("id,username,display_name,bio,avatar_url,verified,created_at")
            .in("id", actorIds)
        : { data: [] };

      const actorMap = new Map(
        ((actors || []) as Profile[]).map((actor) => [actor.id, actor])
      );

      setItems(
        rows.map((item) => ({
          ...item,
          actor: actorMap.get(item.actor_id),
        }))
      );

      const collabResult = await supabase
        .from("post_collaborators")
        .select("post_id,invited_by,created_at")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      const collabRows = collabResult.data || [];
      const inviterIds = [
        ...new Set(collabRows.map((row) => row.invited_by)),
      ];
      const inviterResult = inviterIds.length
        ? await supabase
            .from("profiles")
            .select("id,username,display_name,bio,avatar_url,verified,created_at")
            .in("id", inviterIds)
        : { data: [], error: null };
      const inviterMap = new Map(
        ((inviterResult.data || []) as Profile[]).map((profile) => [
          profile.id,
          profile,
        ])
      );
      setCollabInvites(
        collabRows.map((row) => ({
          ...row,
          inviter: inviterMap.get(row.invited_by),
        }))
      );

      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_id", userId)
        .is("read_at", null);

      onRead();
      setLoading(false);
    }

    void load();
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
        text="Follows, likes, comments, collaborations and messages."
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
      ) : items.length === 0 ? (
        <EmptyState
          title="No activity yet."
          text="When people interact with you, it will appear here."
        />
      ) : (
        <div className="notification-list">
          {items.map((item) => {
            const actorName = item.actor?.display_name || "Someone";
            const copy =
              item.type === "follow"
                ? "followed you"
                : item.type === "follow_request"
                  ? "requested to follow you"
                  : item.type === "follow_request_accepted"
                    ? "accepted your follow request"
                    : item.type === "like"
                  ? "liked your post"
                  : item.type === "comment"
                    ? "commented on your post"
                    : item.type === "collab_invite"
                      ? "invited you to collaborate on a post"
                      : item.type === "collab_accepted"
                        ? "accepted your post collaboration invite"
                    : item.type === "message_request"
                      ? "sent you a message request"
                      : item.type === "message_reply"
                        ? "replied to your message"
                        : item.type === "message_reaction"
                          ? "reacted to your message"
                          : "sent you a message";

            return (
              <div className="notification" key={item.id}>
                <AvatarImage
                  src={
                    item.actor
                      ? avatarFor(item.actor)
                      : initialsAvatar(actorName)
                  }
                  alt={actorName}
                  size={80}
                />
                <div>
                  <p>
                    <b>{actorName}<VerifiedBadge verified={item.actor?.verified} /></b> {copy}
                  </p>
                  <small>{formatRelativeTime(item.created_at)}</small>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

