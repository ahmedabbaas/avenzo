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
      type: "follow" | "like" | "comment" | "message";
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
            .select("id,username,display_name,bio,avatar_url,created_at")
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
                    : "sent you a message";

            return (
              <div className="notification" key={item.id}>
                <img
                  src={
                    item.actor
                      ? avatarFor(item.actor)
                      : initialsAvatar(actorName)
                  }
                  alt=""
                />
                <div>
                  <p>
                    <b>{actorName}</b> {copy}
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

