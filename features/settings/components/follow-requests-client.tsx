"use client";

import { useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import AvatarImage from "../../social/components/avatar-image";
import VerifiedBadge from "../../social/components/verified-badge";
import { avatarFor } from "../../social/lib/profile";
import type { Profile } from "../../social/types";

type FollowRequestItem = {
  requester: Profile;
  created_at: string;
};

export default function FollowRequestsClient({
  initialRequests,
}: {
  initialRequests: FollowRequestItem[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [requests, setRequests] = useState(initialRequests);
  const [busyId, setBusyId] = useState("");
  const [status, setStatus] = useState("");

  async function respond(person: Profile, accept: boolean) {
    setBusyId(person.id);
    setStatus("");

    const { error } = await supabase.rpc("respond_follow_request", {
      requester: person.id,
      accept_request: accept,
    });

    setBusyId("");

    if (error) {
      setStatus("Could not update this follow request.");
      return;
    }

    setRequests((current) =>
      current.filter((item) => item.requester.id !== person.id)
    );
    setStatus(
      accept
        ? "Accepted @" + person.username + "."
        : "Declined @" + person.username + "."
    );
  }

  return (
    <div className="follow-requests-card">
      <div className="follow-requests-summary">
        <div>
          <b>Pending requests</b>
          <span>
            Only approved people can see private posts and reels.
          </span>
        </div>
        <strong>{requests.length}</strong>
      </div>

      {requests.length === 0 ? (
        <div className="settings-empty-state">
          <span>A</span>
          <b>No pending follow requests</b>
          <p>
            New requests will appear here when your account is private.
          </p>
        </div>
      ) : (
        <div className="follow-requests-list">
          {requests.map(({ requester, created_at }) => (
            <div className="follow-request-row" key={requester.id}>
              <AvatarImage
                src={avatarFor(requester)}
                alt={requester.display_name}
                size={80}
              />

              <div className="follow-request-copy">
                <b className="verified-line">
                  {requester.display_name}
                  <VerifiedBadge verified={requester.verified} />
                </b>
                <span>@{requester.username}</span>
                <small>
                  {new Date(created_at).toLocaleDateString()}
                </small>
              </div>

              <div className="follow-request-actions">
                <button
                  type="button"
                  className="btn small"
                  disabled={busyId === requester.id}
                  onClick={() => void respond(requester, true)}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={busyId === requester.id}
                  onClick={() => void respond(requester, false)}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {status && (
        <p className="settings-status" role="status" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  );
}
