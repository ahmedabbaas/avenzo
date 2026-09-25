"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";
import AvatarImage from "../../social/components/avatar-image";
import VerifiedBadge from "../../social/components/verified-badge";
import Icon from "../../social/components/icon";
import { avatarFor, formatRelativeTime } from "../../social/lib/profile";
import type { Profile } from "../../social/types";
import {
  createBroadcastChannel,
  fetchBroadcastChannels,
  fetchBroadcastPosts,
  joinBroadcastChannel,
  leaveBroadcastChannel,
  publishBroadcastPost,
  setBroadcastReaction,
} from "../channel-data";
import type {
  BroadcastChannel,
  BroadcastPost,
} from "../channel-types";

function letter(channel: BroadcastChannel) {
  return channel.title.trim().charAt(0).toUpperCase() || "C";
}

export default function BroadcastChannelsWorkspace({
  currentUser,
}: {
  currentUser: Profile;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [channels, setChannels] = useState<BroadcastChannel[]>([]);
  const [active, setActive] = useState<BroadcastChannel | null>(null);
  const [posts, setPosts] = useState<BroadcastPost[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [postBody, setPostBody] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const loadChannels = useCallback(async () => {
    const next = await fetchBroadcastChannels(supabase, currentUser.id);
    setChannels(next);
    if (active) {
      const replacement = next.find((item) => item.id === active.id);
      if (replacement) setActive(replacement);
    }
    return next;
  }, [supabase, currentUser.id, active]);

  const loadChannel = useCallback(async (channel: BroadcastChannel) => {
    setActive(channel);
    setPosts(await fetchBroadcastPosts(supabase, channel.id));
    window.setTimeout(() => {
      const node = bodyRef.current;
      if (node) node.scrollTop = node.scrollHeight;
    }, 0);
  }, [supabase]);

  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      void loadChannels()
        .catch(() => {
          if (alive) setNotice("Channels could not be loaded.");
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 0);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [loadChannels]);

  useEffect(() => {
    const channel = supabase
      .channel("avenzo-broadcast-channel-feed-" + currentUser.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "broadcast_channel_posts" },
        async ({ new: inserted }) => {
          const row = inserted as { channel_id: string };
          await loadChannels();
          if (active?.id === row.channel_id) {
            setPosts(await fetchBroadcastPosts(supabase, active.id));
            window.setTimeout(() => {
              const node = bodyRef.current;
              if (node) node.scrollTop = node.scrollHeight;
            }, 0);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "broadcast_channel_reactions",
        },
        () => {
          if (active) {
            void fetchBroadcastPosts(supabase, active.id).then(setPosts);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, currentUser.id, active?.id, loadChannels]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function reactToChannelPost(
    post: BroadcastPost,
    emoji: string
  ) {
    const mine = post.reactions.find(
      (reaction) => reaction.user_id === currentUser.id
    );

    try {
      await setBroadcastReaction(
        supabase,
        currentUser.id,
        post.id,
        emoji,
        mine?.emoji === emoji
      );
      if (active) {
        setPosts(await fetchBroadcastPosts(supabase, active.id));
      }
    } catch {
      setNotice("Reaction could not be updated.");
    }
  }

  async function createChannel() {
    if (!title.trim()) {
      setNotice("Add a channel name.");
      return;
    }
    setBusy(true);
    try {
      const id = await createBroadcastChannel(
        supabase,
        title.trim(),
        description.trim()
      );
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      const next = await loadChannels();
      const created = next.find((item) => item.id === id);
      if (created) await loadChannel(created);
      setNotice("Channel created.");
    } catch {
      setNotice("Channel could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleJoin() {
    if (!active) return;
    setBusy(true);
    try {
      if (active.joined && active.role !== "owner") {
        await leaveBroadcastChannel(supabase, active.id);
        setPosts([]);
        setActive(null);
        await loadChannels();
        setNotice("You left the channel.");
      } else if (!active.joined) {
        await joinBroadcastChannel(supabase, active.id);
        const next = await loadChannels();
        const replacement = next.find((item) => item.id === active.id);
        if (replacement) {
          setActive(replacement);
          setPosts(await fetchBroadcastPosts(supabase, replacement.id));
        }
        setNotice("Joined channel.");
      }
    } catch {
      setNotice("Channel membership could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!active || !postBody.trim() || busy) return;

    setBusy(true);
    try {
      await publishBroadcastPost(supabase, active.id, postBody.trim());
      setPostBody("");
      setPosts(await fetchBroadcastPosts(supabase, active.id));
      await loadChannels();
    } catch {
      setNotice("Channel post could not be published.");
    } finally {
      setBusy(false);
    }
  }

  const canPublish =
    active?.role === "owner" || active?.role === "moderator";

  return (
    <div className="channel-workspace">
      <section
        className={
          "channel-sidebar " + (active ? "channel-mobile-hidden" : "")
        }
      >
        <div className="channel-sidebar-head">
          <div>
            <div className="eyebrow">COMMUNITY</div>
            <h1>Channels</h1>
          </div>
          <button
            type="button"
            className="btn small"
            onClick={() => setCreateOpen(true)}
          >
            <Icon name="plus" size={16} />
            Create
          </button>
        </div>

        <div className="channel-switch-row">
          <Link href="/messages">Messages</Link>
          <Link href="/messages/groups">Groups</Link>
          <span>Channels</span>
        </div>

        <div className="channel-list">
          {loading ? (
            <div className="channel-empty">
              <span className="loader" />
              <p>Loading channels…</p>
            </div>
          ) : channels.length === 0 ? (
            <div className="channel-empty">
              <div className="group-empty-icon">
                <Icon name="messages" size={24} />
              </div>
              <h3>No channels yet</h3>
              <p>Create AVENZO’s first real broadcast channel.</p>
              <button
                type="button"
                className="btn small"
                onClick={() => setCreateOpen(true)}
              >
                Create Channel
              </button>
            </div>
          ) : (
            channels.map((channel) => (
              <button
                type="button"
                key={channel.id}
                className={
                  "channel-row " + (active?.id === channel.id ? "active" : "")
                }
                onClick={() => void loadChannel(channel)}
              >
                <span className="channel-avatar">
                  {channel.avatar_url ? (
                    <img src={channel.avatar_url} alt="" />
                  ) : (
                    <b>{letter(channel)}</b>
                  )}
                </span>
                <span>
                  <strong>{channel.title}</strong>
                  <small>
                    {channel.member_count} members
                    {channel.joined ? " · Joined" : ""}
                  </small>
                </span>
                <time>
                  {formatRelativeTime(
                    channel.last_post_at || channel.created_at
                  )}
                </time>
              </button>
            ))
          )}
        </div>
      </section>

      <section
        className={
          "channel-feed " + (!active ? "channel-mobile-hidden" : "")
        }
      >
        {!active ? (
          <div className="channel-empty channel-feed-placeholder">
            <div className="group-empty-icon">
              <Icon name="messages" size={26} />
            </div>
            <h2>Broadcast Channels</h2>
            <p>Join a channel to follow creator updates.</p>
          </div>
        ) : (
          <>
            <header className="channel-feed-head">
              <button
                type="button"
                className="group-back"
                onClick={() => setActive(null)}
                aria-label="Back to channels"
              >
                <Icon name="back" size={21} />
              </button>
              <span className="channel-avatar">
                {active.avatar_url ? (
                  <img src={active.avatar_url} alt="" />
                ) : (
                  <b>{letter(active)}</b>
                )}
              </span>
              <div>
                <b>{active.title}</b>
                <small>
                  {active.member_count} members ·{" "}
                  {active.is_public ? "Public" : "Private"}
                </small>
              </div>
              {active.role !== "owner" && (
                <button
                  type="button"
                  className={
                    "btn small " + (active.joined ? "secondary" : "")
                  }
                  disabled={busy}
                  onClick={() => void toggleJoin()}
                >
                  {active.joined ? "Leave" : "Join"}
                </button>
              )}
            </header>

            <div className="channel-hero">
              <h2>{active.title}</h2>
              {active.description && <p>{active.description}</p>}
              <span>
                {active.member_count} real AVENZO members
              </span>
            </div>

            <div className="channel-posts" ref={bodyRef}>
              {posts.length === 0 ? (
                <div className="channel-empty">
                  <h3>No updates yet</h3>
                  <p>
                    {canPublish
                      ? "Publish the first update to this channel."
                      : "This channel has not posted anything yet."}
                  </p>
                </div>
              ) : (
                posts.map((post) => (
                  <article className="channel-post" key={post.id}>
                    <div className="channel-post-head">
                      <AvatarImage
                        src={avatarFor({
                          id: post.author_id,
                          username: post.author_username,
                          display_name: post.author_name,
                          bio: "",
                          avatar_url: post.author_avatar_url,
                          verified: post.author_verified,
                        })}
                        alt={post.author_name}
                        size={72}
                      />
                      <div>
                        <b className="verified-line">
                          {post.author_name}
                          <VerifiedBadge verified={post.author_verified} />
                        </b>
                        <small>
                          {post.author_username
                            ? "@" + post.author_username
                            : "Account unavailable"}{" · "}
                          {formatRelativeTime(post.created_at)}
                        </small>
                      </div>
                    </div>
                    <p>{post.deleted_at ? "Update deleted" : post.body}</p>
                    {!post.deleted_at && (
                      <div className="channel-post-reactions">
                        {["❤️", "👍", "🔥", "👏"].map((emoji) => {
                          const count = post.reactions.filter(
                            (reaction) => reaction.emoji === emoji
                          ).length;
                          const mine = post.reactions.some(
                            (reaction) =>
                              reaction.emoji === emoji &&
                              reaction.user_id === currentUser.id
                          );
                          return (
                            <button
                              type="button"
                              key={emoji}
                              className={mine ? "mine" : ""}
                              onClick={() =>
                                void reactToChannelPost(post, emoji)
                              }
                              aria-label={"React " + emoji}
                            >
                              <span>{emoji}</span>
                              {count > 0 && <small>{count}</small>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>

            {canPublish && (
              <form className="channel-composer" onSubmit={publish}>
                <textarea
                  rows={1}
                  maxLength={5000}
                  value={postBody}
                  onChange={(event) => setPostBody(event.target.value)}
                  placeholder="Broadcast an update…"
                  aria-label="Channel update"
                />
                <button
                  className="send-button"
                  disabled={!postBody.trim() || busy}
                  aria-label="Publish update"
                >
                  <Icon name="send" size={19} />
                </button>
              </form>
            )}
          </>
        )}
      </section>

      {notice && (
        <div className="dm-inline-notice group-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")}>×</button>
        </div>
      )}

      {createOpen && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label="Create channel"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="group-create-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="group-create-head">
              <div>
                <small>NEW CHANNEL</small>
                <h2>Create Broadcast Channel</h2>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Close"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <label className="settings-field">
              <span>Channel name</span>
              <input
                value={title}
                maxLength={80}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. AVENZO Updates"
              />
            </label>

            <label className="settings-field">
              <span>Description</span>
              <textarea
                value={description}
                maxLength={280}
                rows={3}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What is this channel about?"
              />
            </label>

            <button
              type="button"
              className="btn group-create-submit"
              disabled={busy || !title.trim()}
              onClick={() => void createChannel()}
            >
              {busy ? "Creating…" : "Create Channel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
