"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "../../../lib/supabase/client";

declare global {
  interface Window {
    AvenzoNative?: {
      notifyMessage?: (title: string, body: string, route: string) => void;
      registerSession?: (accessToken: string, userId: string) => void;
    };
  }
}

type MessageNotificationRow = {
  recipient_id: string;
  actor_id: string;
  type: string;
};

type NativeSession = {
  access_token: string;
  user: { id: string };
} | null;

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
    let channelUserId = "";

    const clearChannel = () => {
      if (!channel) return;
      const previous = channel;
      channel = null;
      channelUserId = "";
      void supabase.removeChannel(previous);
    };

    const bindSession = (session: NativeSession) => {
      if (disposed) return;

      if (!session?.user) {
        window.AvenzoNative?.registerSession?.("", "");
        clearChannel();
        return;
      }

      window.AvenzoNative?.registerSession?.(
        session.access_token,
        session.user.id
      );

      const user = session.user;
      if (channel && channelUserId === user.id) return;

      clearChannel();
      channelUserId = user.id;
      channel = supabase
        .channel("avenzo-native-message-notifications-" + user.id)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: "recipient_id=eq." + user.id,
          },
          async ({ new: inserted }) => {
            const notification = inserted as MessageNotificationRow;
            if (!MESSAGE_TYPES.has(notification.type)) return;
            if (!window.AvenzoNative?.notifyMessage) return;

            if (document.visibilityState !== "visible") return;
            if (window.location.pathname.startsWith("/messages")) return;

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

            window.AvenzoNative.notifyMessage?.(title, body, route);
          }
        )
        .subscribe();
    };

    void supabase.auth.getSession().then(({ data }) => {
      bindSession(data.session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        bindSession(session);
      }
    );

    return () => {
      disposed = true;
      authListener.subscription.unsubscribe();
      clearChannel();
    };
  }, [supabase]);

  return null;
}
