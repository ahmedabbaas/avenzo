"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "../../../lib/supabase/client";

declare global {
  interface Window {
    AvenzoNative?: {
      notifyMessage: (title: string, body: string, route: string) => void;
    };
  }
}

type MessageNotificationRow = {
  recipient_id: string;
  actor_id: string;
  type: string;
};

const MESSAGE_TYPES = new Set([
  "message",
  "message_request",
  "message_reply",
]);

export default function NativeMessageNotifications() {
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void supabase.auth.getUser().then(({ data }) => {
      if (disposed || !data.user) return;

      channel = supabase
        .channel("avenzo-native-message-notifications-" + data.user.id)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: "recipient_id=eq." + data.user.id,
          },
          async ({ new: inserted }) => {
            const notification = inserted as MessageNotificationRow;
            if (!MESSAGE_TYPES.has(notification.type)) return;
            if (!window.AvenzoNative?.notifyMessage) return;

            if (
              document.visibilityState === "visible" &&
              window.location.pathname.startsWith("/messages")
            ) {
              return;
            }

            const actorResult = await supabase
              .from("profiles")
              .select("username,display_name")
              .eq("id", notification.actor_id)
              .maybeSingle();

            const actor = actorResult.data;
            const title = actor?.display_name || "AVENZO";
            const body =
              notification.type === "message_request"
                ? "sent you a message request"
                : notification.type === "message_reply"
                  ? "replied to your message"
                  : "sent you a message";
            const route = actor?.username
              ? "/messages?user=" + encodeURIComponent(actor.username)
              : "/messages";

            window.AvenzoNative.notifyMessage(title, body, route);
          }
        )
        .subscribe();
    });

    return () => {
      disposed = true;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [supabase]);

  return null;
}
