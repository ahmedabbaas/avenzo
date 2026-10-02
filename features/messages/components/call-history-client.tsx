"use client";

import Link from "next/link";
import AvatarImage from "../../social/components/avatar-image";
import Icon from "../../social/components/icon";
import { avatarFor } from "../../social/lib/profile";
import type { Profile } from "../../social/types";

export type CallHistoryRow = {
  id: string;
  conversation_id: string;
  caller_id: string;
  callee_id: string;
  status: "ringing" | "accepted" | "declined" | "ended" | "missed";
  call_type: "audio" | "video";
  created_at: string;
  answered_at: string | null;
  ended_at: string | null;
};

function durationLabel(row: CallHistoryRow) {
  if (!row.answered_at || !row.ended_at) return "";
  const seconds = Math.max(
    0,
    Math.round(
      (new Date(row.ended_at).getTime() -
        new Date(row.answered_at).getTime()) /
        1000
    )
  );
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes + ":" + String(rest).padStart(2, "0");
}

function statusLabel(row: CallHistoryRow, outgoing: boolean) {
  if (row.status === "missed") return outgoing ? "No answer" : "Missed";
  if (row.status === "declined") return outgoing ? "Declined" : "You declined";
  if (row.status === "ringing") return "Ringing";
  if (row.status === "accepted") return "Connected";
  return "Ended";
}

export default function CallHistoryClient({
  currentUserId,
  calls,
  profiles,
}: {
  currentUserId: string;
  calls: CallHistoryRow[];
  profiles: Profile[];
}) {
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

  function callAgain(row: CallHistoryRow, other: Profile) {
    const eventName =
      row.call_type === "video"
        ? "avenzo:start-video-call"
        : "avenzo:start-audio-call";

    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: {
          conversationId: row.conversation_id,
          otherUserId: other.id,
          username: other.username,
          displayName: other.display_name,
          avatarUrl: other.avatar_url,
        },
      })
    );
  }

  if (!calls.length) {
    return (
      <div className="calls-empty">
        <Icon name="phone" size={32} />
        <b>No calls yet</b>
        <p>Your AVENZO voice and video call history will appear here.</p>
        <Link className="btn" href="/messages">Open Messages</Link>
      </div>
    );
  }

  return (
    <div className="calls-list">
      {calls.map((row) => {
        const outgoing = row.caller_id === currentUserId;
        const otherId = outgoing ? row.callee_id : row.caller_id;
        const other = profileMap.get(otherId);
        if (!other) return null;
        const duration = durationLabel(row);

        return (
          <article className="call-history-row" key={row.id}>
            <Link
              className="call-history-person"
              href={"/u/" + encodeURIComponent(other.username)}
            >
              <AvatarImage
                src={avatarFor(other)}
                alt={other.display_name}
                size={96}
              />
              <span>
                <b>{other.display_name}</b>
                <small>
                  {outgoing ? "↗" : "↙"}{" "}
                  {row.call_type === "video" ? "Video" : "Voice"} ·{" "}
                  {statusLabel(row, outgoing)}
                  {duration ? " · " + duration : ""}
                </small>
                <time dateTime={row.created_at}>
                  {new Date(row.created_at).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </span>
            </Link>

            <button
              type="button"
              className="call-history-again"
              onClick={() => callAgain(row, other)}
              aria-label={
                "Call " + other.display_name + " again by " + row.call_type
              }
            >
              <Icon
                name={row.call_type === "video" ? "video" : "phone"}
                size={19}
              />
            </button>
          </article>
        );
      })}
    </div>
  );
}
