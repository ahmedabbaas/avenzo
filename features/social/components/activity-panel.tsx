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
        | "like"
        | "comment"
        | "message"
        | "message_request"
        | "message_reply"
        | "message_reaction";
      created_at: string;
      actor_id: string;
      actor?: Profile;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <>
      <PageTitle
        eyebrow="ACTIVITY"
        title="Notifications"
        text="Follows, likes, comments and messages."
      />

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
                : item.type === "like"
                  ? "liked your post"
                  : item.type === "comment"
                    ? "commented on your post"
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

