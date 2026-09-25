"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import BrandLogo from "../../../components/brand-logo";
import { createClient } from "../../../lib/supabase/client";
import AvatarImage from "./avatar-image";
import VerifiedBadge from "./verified-badge";
import { avatarFor } from "../lib/profile";
import type { FollowRelationshipState, Profile } from "../types";

const PAGE_SIZE = 24;

type ConnectionKind = "followers" | "following";

type TargetProfile = Pick<
  Profile,
  "id" | "username" | "display_name" | "bio" | "avatar_url" | "verified"
>;

type ConnectionRpcRow = {
  profile_id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  verified: boolean;
  followed_at: string;
  viewer_state: FollowRelationshipState;
  total_count: number | string;
};

type ConnectionItem = {
  profile: Profile;
  followedAt: string;
  viewerState: FollowRelationshipState;
};

function relationshipState(value: unknown): FollowRelationshipState {
  if (
    value === "following" ||
    value === "requested" ||
    value === "self"
  ) {
    return value;
  }

  return "none";
}

export default function ConnectionsList({
  viewerId,
  target,
  kind,
}: {
  viewerId: string;
  target: TargetProfile;
  kind: ConnectionKind;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ConnectionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const ownList = target.id === viewerId;
  const title = kind === "followers" ? "Followers" : "Following";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim().slice(0, 80));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search]);

  const fetchPage = useCallback(
    async (offset: number) => {
      const { data, error: rpcError } = await supabase.rpc(
        "get_profile_connections",
        {
          target_user: target.id,
          connection_type: kind,
          search_term: debouncedSearch,
          page_limit: PAGE_SIZE,
          page_offset: offset,
        }
      );

      if (rpcError) throw rpcError;

      const rows = (data || []) as ConnectionRpcRow[];

      return {
        items: rows.map((row) => ({
          profile: {
            id: row.profile_id,
            username: row.username,
            display_name: row.display_name,
            bio: row.bio || "",
            avatar_url: row.avatar_url,
            verified: Boolean(row.verified),
          },
          followedAt: row.followed_at,
          viewerState: relationshipState(row.viewer_state),
        })),
        total: rows.length ? Number(rows[0].total_count || 0) : 0,
      };
    },
    [debouncedSearch, kind, supabase, target.id]
  );

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");
    setStatus("");

    void fetchPage(0)
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setTotal(result.total);
      })
      .catch(() => {
        if (!active) return;
        setItems([]);
        setTotal(0);
        setError("Something went wrong. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchPage]);

  async function loadMore() {
    if (loadingMore || items.length >= total) return;

    setLoadingMore(true);
    setError("");

    try {
      const result = await fetchPage(items.length);
      setItems((current) => [...current, ...result.items]);
      if (result.total) setTotal(result.total);
    } catch {
      setError("Could not load more people. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleFollow(item: ConnectionItem) {
    if (busyId) return;

    const previous = item.viewerState;
    if (previous === "self") return;

    setBusyId(item.profile.id);
    setStatus("");

    const { data, error: followError } = await supabase.rpc(
      previous === "following" || previous === "requested"
        ? "unfollow_or_cancel_request"
        : "request_or_follow_user",
      { target_user: item.profile.id }
    );

    setBusyId("");

    if (followError) {
      setStatus("Could not update follow right now.");
      return;
    }

    const next = relationshipState(data);

    if (
      ownList &&
      kind === "following" &&
      previous === "following" &&
      next === "none"
    ) {
      setItems((current) =>
        current.filter((entry) => entry.profile.id !== item.profile.id)
      );
      setTotal((current) => Math.max(0, current - 1));
      setStatus("Unfollowed @" + item.profile.username + ".");
      return;
    }

    setItems((current) =>
      current.map((entry) =>
        entry.profile.id === item.profile.id
          ? { ...entry, viewerState: next }
          : entry
      )
    );

    setStatus(
      next === "requested"
        ? "Follow request sent to @" + item.profile.username + "."
        : next === "following"
          ? "Following @" + item.profile.username + "."
          : "No longer following @" + item.profile.username + "."
    );
  }

  async function removeFollower(item: ConnectionItem) {
    if (!ownList || kind !== "followers" || busyId) return;

    setBusyId(item.profile.id);
    setStatus("");

    const { data, error: removeError } = await supabase.rpc(
      "remove_follower",
      { target_follower: item.profile.id }
    );

    setBusyId("");

    if (removeError || !data) {
      setStatus("Could not remove this follower right now.");
      return;
    }

    setItems((current) =>
      current.filter((entry) => entry.profile.id !== item.profile.id)
    );
    setTotal((current) => Math.max(0, current - 1));
    setStatus("Removed @" + item.profile.username + " from your followers.");
  }

  function actionLabel(state: FollowRelationshipState) {
    if (state === "following") return "Following";
    if (state === "requested") return "Requested";
    return "Follow";
  }

  return (
    <main className="connections-shell">
      <header className="connections-top">
        <Link
          className="connections-back"
          href={
            ownList
              ? "/home?screen=profile"
              : "/u/" + encodeURIComponent(target.username)
          }
          aria-label="Back to profile"
        >
          ←
        </Link>

        <Link className="connections-brand" href="/home">
          <BrandLogo size={31} />
          <span>AVENZO</span>
        </Link>

        <span className="connections-top-spacer" aria-hidden="true" />
      </header>

      <section className="connections-wrap">
        <div className="connections-heading">
          <AvatarImage
            src={avatarFor(target as Profile)}
            alt={target.display_name}
            size={84}
          />
          <div>
            <span>@{target.username}</span>
            <h1>{title}</h1>
            <p>
              {total.toLocaleString()} {title.toLowerCase()}
            </p>
          </div>
        </div>

        <label className="connections-search">
          <span className="sr-only">Search {title.toLowerCase()}</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={"Search " + title.toLowerCase()}
            autoComplete="off"
            inputMode="search"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </label>

        {status && (
          <p className="connections-status" role="status" aria-live="polite">
            {status}
          </p>
        )}

        {error && (
          <div className="connections-error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                setDebouncedSearch((current) => current + " ");
                window.setTimeout(
                  () => setDebouncedSearch(search.trim().slice(0, 80)),
                  0
                );
              }}
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="connections-list" aria-label={"Loading " + title}>
            {Array.from({ length: 7 }, (_, index) => (
              <div className="connection-row connection-skeleton" key={index}>
                <i />
                <div>
                  <b />
                  <span />
                </div>
                <em />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="connections-empty">
            <span>A</span>
            <b>
              {debouncedSearch
                ? "No matching people"
                : kind === "followers"
                  ? "No followers yet"
                  : "Not following anyone yet"}
            </b>
            <p>
              {debouncedSearch
                ? "Try a different username or name."
                : ownList
                  ? "Connections will appear here as your AVENZO network grows."
                  : "There is nothing to show here yet."}
            </p>
          </div>
        ) : (
          <>
            <div className="connections-list">
              {items.map((item) => {
                const profileHref =
                  item.profile.id === viewerId
                    ? "/home?screen=profile"
                    : "/u/" + encodeURIComponent(item.profile.username);

                return (
                  <article className="connection-row" key={item.profile.id}>
                    <Link
                      className="connection-avatar"
                      href={profileHref}
                      aria-label={"Open @" + item.profile.username}
                    >
                      <AvatarImage
                        src={avatarFor(item.profile)}
                        alt={item.profile.display_name}
                        size={96}
                      />
                    </Link>

                    <Link className="connection-copy" href={profileHref}>
                      <b className="verified-line">
                        @{item.profile.username}
                        <VerifiedBadge verified={item.profile.verified} />
                      </b>
                      <span>{item.profile.display_name}</span>
                      {item.profile.bio && <small>{item.profile.bio}</small>}
                    </Link>

                    <div className="connection-actions">
                      {item.viewerState !== "self" && (
                        <button
                          type="button"
                          className={
                            item.viewerState === "none"
                              ? "btn small"
                              : "btn secondary small"
                          }
                          disabled={busyId === item.profile.id}
                          onClick={() => void toggleFollow(item)}
                        >
                          {busyId === item.profile.id
                            ? "..."
                            : actionLabel(item.viewerState)}
                        </button>
                      )}

                      {ownList &&
                        kind === "followers" &&
                        item.profile.id !== viewerId && (
                          <button
                            type="button"
                            className="btn secondary small connection-remove"
                            disabled={busyId === item.profile.id}
                            onClick={() => void removeFollower(item)}
                          >
                            Remove
                          </button>
                        )}
                    </div>
                  </article>
                );
              })}
            </div>

            {items.length < total && (
              <div className="connections-load-more">
                <button
                  type="button"
                  className="btn secondary"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
