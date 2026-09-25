"use client";

import { useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import AvatarImage from "../../social/components/avatar-image";
import { avatarFor } from "../../social/lib/profile";
import type { Profile } from "../../social/types";

type CloseFriend = Profile;

export default function CloseFriendsClient({
  currentUserId,
  initialFriends,
}: {
  currentUserId: string;
  initialFriends: CloseFriend[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [friends, setFriends] = useState(initialFriends);
  const [results, setResults] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState("");
  const [status, setStatus] = useState("");
  const [searching, setSearching] = useState(false);

  const friendIds = useMemo(
    () => new Set(friends.map((friend) => friend.id)),
    [friends]
  );

  async function searchPeople(value: string) {
    const next = value.slice(0, 60);
    setQuery(next);
    setStatus("");

    const clean = next.trim();
    if (!clean) {
      setResults([]);
      return;
    }

    setSearching(true);

    const safe = clean.replace(/[,%]/g, "");
    const { data, error } = await supabase
      .from("profiles")
      .select("id,username,display_name,bio,avatar_url,verified,created_at")
      .neq("id", currentUserId)
      .or(
        "username.ilike.%" +
          safe +
          "%,display_name.ilike.%" +
          safe +
          "%"
      )
      .limit(30);

    setSearching(false);

    if (error) {
      setStatus("Search is unavailable right now.");
      return;
    }

    setResults((data || []) as Profile[]);
  }

  async function toggleFriend(person: Profile) {
    const included = friendIds.has(person.id);
    setBusyId(person.id);
    setStatus("");

    const result = included
      ? await supabase
          .from("close_friends")
          .delete()
          .eq("user_id", currentUserId)
          .eq("friend_id", person.id)
      : await supabase.from("close_friends").insert({
          user_id: currentUserId,
          friend_id: person.id,
        });

    setBusyId("");

    if (result.error) {
      setStatus(
        included
          ? "Could not remove this person from Close Friends."
          : "Could not add this person to Close Friends."
      );
      return;
    }

    setFriends((current) =>
      included
        ? current.filter((item) => item.id !== person.id)
        : [...current, person]
    );

    setStatus(
      included
        ? "Removed @" + person.username + " from Close Friends."
        : "Added @" + person.username + " to Close Friends."
    );
  }

  const visiblePeople = query.trim() ? results : friends;

  return (
    <div className="close-friends-card">
      <div className="close-friends-search">
        <input
          value={query}
          onChange={(event) => void searchPeople(event.target.value)}
          placeholder="Search people"
          autoCapitalize="none"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
          >
            Clear
          </button>
        )}
      </div>

      <div className="close-friends-summary">
        <div>
          <b>Close Friends</b>
          <span>
            Only you can see who is on this list. Membership is never shown publicly.
          </span>
        </div>
        <strong>{friends.length}</strong>
      </div>

      {searching ? (
        <p className="settings-status">Searching…</p>
      ) : visiblePeople.length === 0 ? (
        <div className="settings-empty-state">
          <span>A</span>
          <b>{query.trim() ? "No matching users" : "Your Close Friends list is empty"}</b>
          <p>
            {query.trim()
              ? "Try another real username or display name."
              : "Search for people above to add them to your private audience."}
          </p>
        </div>
      ) : (
        <div className="close-friends-list">
          {visiblePeople.map((person) => {
            const included = friendIds.has(person.id);
            return (
              <div className="close-friends-row" key={person.id}>
                <AvatarImage
                  src={avatarFor(person)}
                  alt={person.display_name}
                  size={88}
                />
                <div>
                  <b>{person.display_name}</b>
                  <span>@{person.username}</span>
                  <small>
                    {included
                      ? "In your Close Friends"
                      : "Not in your Close Friends"}
                  </small>
                </div>
                <button
                  type="button"
                  className={
                    included ? "btn secondary small" : "btn small"
                  }
                  disabled={busyId === person.id}
                  onClick={() => void toggleFriend(person)}
                >
                  {busyId === person.id
                    ? "Saving…"
                    : included
                      ? "Remove"
                      : "Add"}
                </button>
              </div>
            );
          })}
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
