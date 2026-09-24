"use client";

import {
  type ChangeEvent,
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
import Icon from "../../social/components/icon";
import { avatarFor, formatRelativeTime } from "../../social/lib/profile";
import type { Profile } from "../../social/types";
import {
  acceptMessageRequest,
  blockUserFromMessages,
  declineMessageRequest,
  deleteConversationForMe,
  deleteMessageForEveryone,
  editMessage,
  ensureConversation,
  fetchConversationMessages,
  fetchInbox,
  fetchMessageUsers,
  fetchMessagingPrivacy,
  getExistingConversation,
  hideMessageForMe,
  markMessagesRead,
  reportMessage,
  reportUserFromMessages,
  restrictUser,
  sendDirectMessage,
  sendMessageAttachment,
  setConversationMuted,
  setMessageReaction,
} from "../data";
import type {
  DirectMessage,
  InboxConversation,
  MessageReaction,
} from "../types";

const REACTIONS = ["❤️", "😂", "👍", "😮", "😢", "😡"];
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/webm",
  "audio/mpeg",
  "audio/mp4",
  "application/pdf",
  "text/plain",
]);

function profileFromInbox(item: InboxConversation): Profile {
  return {
    id: item.other_user_id,
    username: item.username,
    display_name: item.display_name,
    bio: "",
    avatar_url: item.avatar_url,
  };
}

function dateLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((today.getTime() - target.getTime()) / 86400000);

  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function messageTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function receipt(message: DirectMessage, own: boolean) {
  if (!own) return "";
  if (message.read_at) return "✓✓ Seen";
  if (message.delivered_at) return "✓✓ Delivered";
  return "✓ Sent";
}

function reactionGroups(reactions: MessageReaction[]) {
  const grouped = new Map<string, number>();
  for (const reaction of reactions) {
    grouped.set(reaction.emoji, (grouped.get(reaction.emoji) || 0) + 1);
  }
  return [...grouped.entries()];
}

export default function MessagesWorkspace({
  currentUser,
  initialUsername = "",
  sharePostId = "",
  shareReelId = "",
  shareProfileId = "",
}: {
  currentUser: Profile;
  initialUsername?: string;
  sharePostId?: string;
  shareReelId?: string;
  shareProfileId?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [inbox, setInbox] = useState<InboxConversation[]>([]);
  const [requests, setRequests] = useState<InboxConversation[]>([]);
  const [active, setActive] = useState<InboxConversation | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [messageQuery, setMessageQuery] = useState("");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<DirectMessage | null>(null);
  const [tab, setTab] = useState<"inbox" | "requests">("inbox");
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [reactionFor, setReactionFor] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherAllowsOnline, setOtherAllowsOnline] = useState(false);
  const [ownOnlineEnabled, setOwnOnlineEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [viewer, setViewer] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<number | null>(null);
  const activeRef = useRef<InboxConversation | null>(null);

  const pendingShare = sharePostId || shareReelId || shareProfileId;

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const loadLists = useCallback(async () => {
    const [nextInbox, nextRequests] = await Promise.all([
      fetchInbox(supabase, false),
      fetchInbox(supabase, true),
    ]);
    setInbox(nextInbox);
    setRequests(nextRequests);

    const current = activeRef.current;
    if (current) {
      const replacement = [...nextInbox, ...nextRequests].find(
        (item) => item.conversation_id === current.conversation_id
      );
      if (replacement) setActive(replacement);
    }
  }, [supabase]);

  const loadPeople = useCallback(
    async (search = "") => {
      setPeople(await fetchMessageUsers(supabase, currentUser.id, search));
    },
    [supabase, currentUser.id]
  );

  const loadConversation = useCallback(
    async (conversation: InboxConversation) => {
      setActive(conversation);
      setMessages(
        await fetchConversationMessages(
          supabase,
          conversation.conversation_id
        )
      );

      if (!conversation.request_incoming) {
        await markMessagesRead(
          supabase,
          conversation.conversation_id,
          currentUser.id
        );
      }

      const privacy = await fetchMessagingPrivacy(
        supabase,
        conversation.other_user_id
      );
      setOtherAllowsOnline(privacy.onlineStatus);
      await loadLists();
      window.setTimeout(() => {
        bodyRef.current?.scrollTo({
          top: bodyRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 50);
    },
    [supabase, currentUser.id, loadLists]
  );

  useEffect(() => {
    let activeEffect = true;

    void Promise.all([
      loadLists(),
      loadPeople(),
      supabase
        .from("privacy_settings")
        .select("online_status")
        .eq("user_id", currentUser.id)
        .single(),
    ])
      .then(async ([, users, privacyResult]) => {
        if (!activeEffect) return;
        setOwnOnlineEnabled(privacyResult.data?.online_status ?? true);
        setLoading(false);

        if (initialUsername) {
          const person = users.find(
            (item) =>
              item.username.toLowerCase() === initialUsername.toLowerCase()
          );
          if (person) {
            const existingId = await getExistingConversation(
              supabase,
              person.id
            );
            if (existingId) {
              const all = [
                ...(await fetchInbox(supabase, false)),
                ...(await fetchInbox(supabase, true)),
              ];
              const found = all.find(
                (item) => item.conversation_id === existingId
              );
              if (found) await loadConversation(found);
            } else {
              setNewMessageOpen(true);
              setQuery(person.username);
            }
          }
        }
      })
      .catch(() => {
        if (activeEffect) {
          setNotice("Messages could not be loaded right now.");
          setLoading(false);
        }
      });

    return () => {
      activeEffect = false;
    };
  }, [
    currentUser.id,
    initialUsername,
    loadConversation,
    loadLists,
    loadPeople,
    supabase,
  ]);

  useEffect(() => {
    if (!query.trim()) {
      void loadPeople();
      return;
    }

    const timer = window.setTimeout(() => {
      void loadPeople(query).catch(() =>
        setNotice("User search is unavailable right now.")
      );
    }, 280);

    return () => window.clearTimeout(timer);
  }, [query, loadPeople]);

  useEffect(() => {
    const channel = supabase
      .channel("avenzo-dm-inbox-" + currentUser.id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: "recipient_id=eq." + currentUser.id,
        },
        async (payload) => {
          const incoming = payload.new as DirectMessage;
          await supabase
            .from("messages")
            .update({ delivered_at: new Date().toISOString() })
            .eq("id", incoming.id);

          if (
            activeRef.current?.conversation_id === incoming.conversation_id
          ) {
            const next = await fetchConversationMessages(
              supabase,
              incoming.conversation_id
            );
            setMessages(next);
            if (!activeRef.current.request_incoming) {
              await markMessagesRead(
                supabase,
                incoming.conversation_id,
                currentUser.id
              );
            }
          }

          await loadLists();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        async () => {
          const conversation = activeRef.current;
          if (!conversation) return;
          setMessages(
            await fetchConversationMessages(
              supabase,
              conversation.conversation_id
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_requests" },
        () => void loadLists()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, currentUser.id, loadLists]);

  useEffect(() => {
    if (!active) {
      setTyping(false);
      setOtherOnline(false);
      return;
    }

    const channel = supabase.channel(
      "avenzo-dm-presence-" + active.conversation_id,
      {
        config: {
          presence: { key: currentUser.id },
          broadcast: { self: false },
        },
      }
    );

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOtherOnline(
          otherAllowsOnline &&
            Object.prototype.hasOwnProperty.call(
              state,
              active.other_user_id
            )
        );
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.userId !== active.other_user_id) return;
        setTyping(Boolean(payload.typing));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && ownOnlineEnabled) {
          await channel.track({
            userId: currentUser.id,
            onlineAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    active,
    currentUser.id,
    otherAllowsOnline,
    ownOnlineEnabled,
    supabase,
  ]);

  async function startConversation(person: Profile) {
    if (person.id === currentUser.id) return;
    setNotice("");

    try {
      const ensured = await ensureConversation(supabase, person.id);
      await loadLists();

      const all = [
        ...(await fetchInbox(supabase, false)),
        ...(await fetchInbox(supabase, true)),
      ];

      const item =
        all.find(
          (conversation) =>
            conversation.conversation_id === ensured.conversationId
        ) || {
          conversation_id: ensured.conversationId,
          other_user_id: person.id,
          username: person.username,
          display_name: person.display_name,
          avatar_url: person.avatar_url,
          last_message: "",
          last_message_type: null,
          last_message_at: new Date().toISOString(),
          unread_count: 0,
          request_status: ensured.requestStatus as InboxConversation["request_status"],
          request_incoming: false,
          muted: false,
        };

      setNewMessageOpen(false);
      setQuery("");
      await loadConversation(item);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to start chat.";
      setNotice(
        message.includes("MESSAGE")
          ? "This account is not accepting messages from you."
          : message
      );
    }
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const clean = text.trim();
    if (!active || !clean || sending || active.request_incoming) return;

    setSending(true);
    setNotice("");

    try {
      const message = await sendDirectMessage({
        supabase,
        conversationId: active.conversation_id,
        senderId: currentUser.id,
        recipientId: active.other_user_id,
        body: clean,
        replyToId: replyTo?.id || null,
      });

      setMessages((current) => [
        ...current,
        { ...message, attachments: [], reactions: [], reply_to: replyTo },
      ]);
      setText("");
      setReplyTo(null);
      await loadLists();
      bodyRef.current?.scrollTo({
        top: bodyRef.current.scrollHeight,
        behavior: "smooth",
      });
    } catch {
      setNotice(
        active.request_status === "pending"
          ? "Wait for this message request to be accepted before sending more."
          : "Message could not be sent."
      );
    } finally {
      setSending(false);
    }
  }

  async function sendShare() {
    if (!active || active.request_incoming || !pendingShare) return;

    const type = sharePostId
      ? "shared_post"
      : shareReelId
        ? "shared_reel"
        : "shared_profile";

    try {
      await sendDirectMessage({
        supabase,
        conversationId: active.conversation_id,
        senderId: currentUser.id,
        recipientId: active.other_user_id,
        body: "",
        messageType: type,
        sharedPostId: sharePostId || null,
        sharedReelId: shareReelId || null,
        sharedProfileId: shareProfileId || null,
      });
      setMessages(
        await fetchConversationMessages(
          supabase,
          active.conversation_id
        )
      );
      setNotice("Shared in conversation.");
      window.history.replaceState({}, "", "/messages");
      await loadLists();
    } catch {
      setNotice("Could not share this item.");
    }
  }

  async function attach(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!active || !file || active.request_incoming) return;

    if (
      file.size > MAX_ATTACHMENT_BYTES ||
      !ALLOWED_ATTACHMENT_TYPES.has(file.type)
    ) {
      setNotice("Choose a supported attachment up to 25 MB.");
      return;
    }

    setSending(true);
    try {
      await sendMessageAttachment({
        supabase,
        conversationId: active.conversation_id,
        senderId: currentUser.id,
        recipientId: active.other_user_id,
        file,
        replyToId: replyTo?.id || null,
      });
      setReplyTo(null);
      setMessages(
        await fetchConversationMessages(
          supabase,
          active.conversation_id
        )
      );
      await loadLists();
    } catch {
      setNotice("Attachment could not be sent.");
    } finally {
      setSending(false);
    }
  }

  async function react(message: DirectMessage, emoji: string) {
    const mine = message.reactions.find(
      (reaction) => reaction.user_id === currentUser.id
    );
    await setMessageReaction(
      supabase,
      currentUser.id,
      message.id,
      mine?.emoji === emoji ? null : emoji
    );
    setReactionFor(null);
    setMessages(
      await fetchConversationMessages(
        supabase,
        message.conversation_id
      )
    );
  }

  async function messageAction(
    action: "copy" | "edit" | "delete_me" | "delete_everyone" | "report",
    message: DirectMessage
  ) {
    try {
      if (action === "copy") {
        await navigator.clipboard.writeText(message.body);
        setNotice("Message copied.");
      }
      if (action === "edit") {
        const next = window.prompt("Edit message", message.body);
        if (next?.trim()) {
          await editMessage(supabase, message.id, next.trim());
        }
      }
      if (action === "delete_me") {
        await hideMessageForMe(supabase, currentUser.id, message.id);
      }
      if (action === "delete_everyone") {
        if (
          window.confirm(
            "Delete this message for everyone? This cannot be undone."
          )
        ) {
          await deleteMessageForEveryone(supabase, message.id);
        }
      }
      if (action === "report") {
        if (window.confirm("Report this message for review?")) {
          await reportMessage(supabase, currentUser.id, message.id);
          setNotice("Message reported.");
        }
      }

      if (active) {
        setMessages(
          await fetchConversationMessages(
            supabase,
            active.conversation_id
          )
        );
      }
    } catch {
      setNotice("That message action could not be completed.");
    }
  }

  async function acceptRequest() {
    if (!active) return;
    await acceptMessageRequest(supabase, active.conversation_id);
    await loadLists();
    const next = (await fetchInbox(supabase, false)).find(
      (item) => item.conversation_id === active.conversation_id
    );
    if (next) await loadConversation(next);
    setTab("inbox");
  }

  async function deleteRequest() {
    if (!active) return;
    await declineMessageRequest(supabase, active.conversation_id);
    setActive(null);
    setMessages([]);
    await loadLists();
  }

  async function conversationAction(
    action: "mute" | "delete" | "block" | "restrict" | "report"
  ) {
    if (!active) return;
    const otherId = active.other_user_id;

    try {
      if (action === "mute") {
        await setConversationMuted(
          supabase,
          active.conversation_id,
          !active.muted
        );
        setNotice(active.muted ? "Conversation unmuted." : "Conversation muted.");
      }
      if (action === "delete") {
        if (
          window.confirm(
            "Delete this conversation from your inbox? The other person keeps their copy."
          )
        ) {
          await deleteConversationForMe(
            supabase,
            active.conversation_id
          );
          setActive(null);
          setMessages([]);
        }
      }
      if (action === "block") {
        if (window.confirm("Block this account? New messages will stop.")) {
          await blockUserFromMessages(
            supabase,
            currentUser.id,
            otherId
          );
          setActive(null);
          setMessages([]);
        }
      }
      if (action === "restrict") {
        await restrictUser(supabase, currentUser.id, otherId);
        setNotice("Account restricted.");
      }
      if (action === "report") {
        if (window.confirm("Report this account for review?")) {
          await reportUserFromMessages(
            supabase,
            currentUser.id,
            otherId
          );
          setNotice("Account reported.");
        }
      }
      setMoreOpen(false);
      await loadLists();
    } catch {
      setNotice("Conversation action failed.");
    }
  }

  function updateTyping(next: string) {
    setText(next.slice(0, 5000));
    if (!active) return;

    const channel = supabase.channel(
      "avenzo-dm-presence-" + active.conversation_id
    );
    void channel.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUser.id, typing: true },
    });

    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      void channel.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: currentUser.id, typing: false },
      });
    }, 1300);
  }

  const shown = (tab === "inbox" ? inbox : requests).filter((item) =>
    (item.display_name + " " + item.username + " " + item.last_message)
      .toLowerCase()
      .includes(query.toLowerCase().trim())
  );

  const filteredMessages = messageQuery.trim()
    ? messages.filter((message) =>
        message.body
          .toLowerCase()
          .includes(messageQuery.toLowerCase().trim())
      )
    : messages;

  let previousDate = "";
  const activeProfile = active ? profileFromInbox(active) : null;

  return (
    <div className="dm-workspace">
      <section className={"dm-sidebar " + (active ? "dm-mobile-hidden" : "")}>
        <div className="dm-sidebar-head">
          <div>
            <div className="eyebrow">MESSAGES</div>
            <h1>Inbox</h1>
          </div>
          <button
            className="btn small"
            onClick={() => setNewMessageOpen(true)}
          >
            <Icon name="plus" size={16} />
            New Message
          </button>
        </div>

        <div className="dm-tabs" role="tablist">
          <button
            className={tab === "inbox" ? "active" : ""}
            onClick={() => {
              setTab("inbox");
              setActive(null);
            }}
          >
            Inbox
          </button>
          <button
            className={tab === "requests" ? "active" : ""}
            onClick={() => {
              setTab("requests");
              setActive(null);
            }}
          >
            Requests
            {requests.length > 0 && <span>{requests.length}</span>}
          </button>
        </div>

        <label className="dm-search">
          <Icon name="search" size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              tab === "inbox"
                ? "Search conversations"
                : "Search requests"
            }
          />
        </label>

        <div className="dm-conversation-list">
          {loading ? (
            <p className="dm-list-empty">Loading conversations…</p>
          ) : shown.length === 0 ? (
            <div className="dm-empty-state">
              <Icon name="messages" size={28} />
              <b>
                {tab === "requests"
                  ? "No message requests"
                  : "No messages yet"}
              </b>
              <p>
                {tab === "requests"
                  ? "New requests from real users will appear here."
                  : "Start a conversation with another AVENZO user."}
              </p>
              {tab === "inbox" && (
                <button
                  className="btn small"
                  onClick={() => setNewMessageOpen(true)}
                >
                  Start a conversation
                </button>
              )}
            </div>
          ) : (
            shown.map((item) => (
              <button
                key={item.conversation_id}
                className={
                  "dm-conversation " +
                  (active?.conversation_id === item.conversation_id
                    ? "active "
                    : "") +
                  (item.unread_count ? "unread" : "")
                }
                onClick={() => void loadConversation(item)}
              >
                <AvatarImage
                  src={avatarFor(profileFromInbox(item))}
                  alt={item.display_name}
                  size={88}
                />
                <span className="dm-conversation-copy">
                  <span>
                    <b>{item.display_name}</b>
                    <small>@{item.username}</small>
                  </span>
                  <em>{item.last_message || "New conversation"}</em>
                </span>
                <span className="dm-conversation-meta">
                  <small>{formatRelativeTime(item.last_message_at)}</small>
                  {item.unread_count > 0 && (
                    <i>{item.unread_count}</i>
                  )}
                  {item.muted && <span title="Muted">⌁</span>}
                </span>
              </button>
            ))
          )}
        </div>
      </section>

      <section className={"dm-chat " + (!active ? "dm-mobile-hidden" : "")}>
        {!active || !activeProfile ? (
          <div className="dm-chat-empty">
            <span className="empty-mark">A</span>
            <h2>Your messages</h2>
            <p>
              Private conversations with real AVENZO accounts appear here.
            </p>
            <button
              className="btn"
              onClick={() => setNewMessageOpen(true)}
            >
              Start a conversation
            </button>
          </div>
        ) : (
          <>
            <header className="dm-chat-head">
              <button
                className="dm-back"
                onClick={() => setActive(null)}
                aria-label="Back to conversations"
              >
                <Icon name="back" size={20} />
              </button>
              <AvatarImage
                src={avatarFor(activeProfile)}
                alt={activeProfile.display_name}
                size={84}
              />
              <div className="dm-head-identity">
                <b>{active.display_name}</b>
                <small>
                  @{active.username}
                  {otherAllowsOnline &&
                    (otherOnline ? " · Online" : " · Offline")}
                </small>
              </div>
              <Link
                className="btn secondary small dm-view-profile"
                href={"/u/" + encodeURIComponent(active.username)}
              >
                View Profile
              </Link>
              <button
                className="icon-button"
                onClick={() => setMoreOpen((value) => !value)}
                aria-label="Conversation options"
              >
                •••
              </button>

              {moreOpen && (
                <div className="dm-more-menu">
                  <button onClick={() => void conversationAction("mute")}>
                    {active.muted ? "Unmute" : "Mute"}
                  </button>
                  <button onClick={() => void conversationAction("restrict")}>
                    Restrict
                  </button>
                  <button onClick={() => void conversationAction("report")}>
                    Report
                  </button>
                  <button onClick={() => void conversationAction("block")}>
                    Block
                  </button>
                  <button
                    className="danger"
                    onClick={() => void conversationAction("delete")}
                  >
                    Delete conversation
                  </button>
                </div>
              )}
            </header>

            <div className="dm-chat-tools">
              <label>
                <Icon name="search" size={15} />
                <input
                  value={messageQuery}
                  onChange={(event) =>
                    setMessageQuery(event.target.value)
                  }
                  placeholder="Search in conversation"
                />
              </label>
              {typing && (
                <span className="dm-typing">
                  {active.username} is typing…
                </span>
              )}
            </div>

            {active.request_incoming && (
              <div className="dm-request-banner">
                <div>
                  <b>Message request from @{active.username}</b>
                  <span>
                    Accept to move this conversation into your inbox.
                  </span>
                </div>
                <div>
                  <button className="btn small" onClick={() => void acceptRequest()}>
                    Accept
                  </button>
                  <button
                    className="btn secondary small"
                    onClick={() => void deleteRequest()}
                  >
                    Delete
                  </button>
                  <button
                    className="btn secondary small"
                    onClick={() => void conversationAction("block")}
                  >
                    Block
                  </button>
                  <button
                    className="btn secondary small"
                    onClick={() => void conversationAction("report")}
                  >
                    Report
                  </button>
                </div>
              </div>
            )}

            {pendingShare && !active.request_incoming && (
              <div className="dm-share-banner">
                <span>
                  Ready to share{" "}
                  {sharePostId
                    ? "a post"
                    : shareReelId
                      ? "a reel"
                      : "a profile"}{" "}
                  with @{active.username}.
                </span>
                <button className="btn small" onClick={() => void sendShare()}>
                  Share
                </button>
              </div>
            )}

            <div className="dm-message-area" ref={bodyRef}>
              {filteredMessages.length === 0 ? (
                <div className="conversation-start">
                  <AvatarImage
                    src={avatarFor(activeProfile)}
                    alt={activeProfile.display_name}
                    size={96}
                  />
                  <b>{active.display_name}</b>
                  <span>@{active.username}</span>
                  <p>
                    {active.request_incoming
                      ? "Review this message request."
                      : "No messages in this conversation yet."}
                  </p>
                </div>
              ) : (
                filteredMessages.map((message) => {
                  const own = message.sender_id === currentUser.id;
                  const nextDate = dateLabel(message.created_at);
                  const showDate = nextDate !== previousDate;
                  previousDate = nextDate;
                  const myReaction = message.reactions.find(
                    (reaction) => reaction.user_id === currentUser.id
                  );

                  return (
                    <div key={message.id}>
                      {showDate && (
                        <div className="dm-date-separator">
                          <span>{nextDate}</span>
                        </div>
                      )}
                      <div
                        id={"message-" + message.id}
                        className={"dm-message-row " + (own ? "me" : "them")}
                      >
                        <div className="dm-message-stack">
                          {message.reply_to && (
                            <button
                              className="dm-reply-preview"
                              onClick={() =>
                                document
                                  .getElementById(
                                    "message-" + message.reply_to_id
                                  )
                                  ?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "center",
                                  })
                              }
                            >
                              <b>
                                {message.reply_to.sender_id === currentUser.id
                                  ? "You"
                                  : active.display_name}
                              </b>
                              <span>
                                {message.reply_to.body ||
                                  "Shared content"}
                              </span>
                            </button>
                          )}

                          {message.deleted_for_everyone_at ? (
                            <div className="dm-bubble deleted">
                              Message deleted
                            </div>
                          ) : (
                            <>
                              {message.body && (
                                <div className="dm-bubble">
                                  {message.body}
                                  {message.edited_at && (
                                    <small className="dm-edited">
                                      edited
                                    </small>
                                  )}
                                </div>
                              )}

                              {message.attachments.map((attachment) => {
                                const url = supabase.storage
                                  .from("media")
                                  .getPublicUrl(attachment.storage_path)
                                  .data.publicUrl;

                                if (attachment.kind === "image") {
                                  return (
                                    <button
                                      className="dm-image-attachment"
                                      key={attachment.id}
                                      onClick={() => setViewer(url)}
                                    >
                                      <img
                                        src={url}
                                        alt={attachment.file_name || "Image"}
                                      />
                                    </button>
                                  );
                                }

                                if (attachment.kind === "video") {
                                  return (
                                    <video
                                      key={attachment.id}
                                      src={url}
                                      controls
                                      playsInline
                                      className="dm-video-attachment"
                                    />
                                  );
                                }

                                if (attachment.kind === "audio") {
                                  return (
                                    <audio
                                      key={attachment.id}
                                      src={url}
                                      controls
                                      className="dm-audio-attachment"
                                    />
                                  );
                                }

                                return (
                                  <a
                                    key={attachment.id}
                                    className="dm-file-attachment"
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    📎 {attachment.file_name || "File"}
                                  </a>
                                );
                              })}

                              {message.shared_post_id && (
                                <div className="dm-shared-card">
                                  <b>Shared post</b>
                                  <span>Open the post on AVENZO.</span>
                                  <Link
                                    href={"/p/" + message.shared_post_id}
                                    className="btn secondary small"
                                  >
                                    Open Post
                                  </Link>
                                </div>
                              )}
                              {message.shared_reel_id && (
                                <div className="dm-shared-card">
                                  <b>Shared reel</b>
                                  <span>View the shared reel on AVENZO.</span>
                                  <Link
                                    href="/home"
                                    className="btn secondary small"
                                  >
                                    Open Reels
                                  </Link>
                                </div>
                              )}
                              {message.shared_profile_id && (
                                <div className="dm-shared-card">
                                  <b>Shared profile</b>
                                  <span>
                                    A profile was shared in this conversation.
                                  </span>
                                </div>
                              )}
                            </>
                          )}

                          {message.reactions.length > 0 && (
                            <div className="dm-reactions">
                              {reactionGroups(message.reactions).map(
                                ([emoji, count]) => (
                                  <button
                                    key={emoji}
                                    className={
                                      myReaction?.emoji === emoji
                                        ? "mine"
                                        : ""
                                    }
                                    onClick={() =>
                                      void react(message, emoji)
                                    }
                                  >
                                    {emoji} {count}
                                  </button>
                                )
                              )}
                            </div>
                          )}

                          <div className="dm-message-meta">
                            <span>{messageTime(message.created_at)}</span>
                            {own && (
                              <span>{receipt(message, true)}</span>
                            )}
                          </div>

                          {!message.deleted_for_everyone_at && (
                            <div className="dm-message-actions">
                              <button onClick={() => setReplyTo(message)}>
                                Reply
                              </button>
                              {message.body && (
                                <button
                                  onClick={() =>
                                    void messageAction("copy", message)
                                  }
                                >
                                  Copy
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  setReactionFor(
                                    reactionFor === message.id
                                      ? null
                                      : message.id
                                  )
                                }
                              >
                                React
                              </button>
                              {own &&
                                message.message_type === "text" && (
                                  <button
                                    onClick={() =>
                                      void messageAction("edit", message)
                                    }
                                  >
                                    Edit
                                  </button>
                                )}
                              <button
                                onClick={() =>
                                  void messageAction("delete_me", message)
                                }
                              >
                                Delete for me
                              </button>
                              {own && (
                                <button
                                  onClick={() =>
                                    void messageAction(
                                      "delete_everyone",
                                      message
                                    )
                                  }
                                >
                                  Delete for everyone
                                </button>
                              )}
                              {!own && (
                                <button
                                  onClick={() =>
                                    void messageAction("report", message)
                                  }
                                >
                                  Report
                                </button>
                              )}

                              {reactionFor === message.id && (
                                <span className="dm-reaction-picker">
                                  {REACTIONS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      onClick={() =>
                                        void react(message, emoji)
                                      }
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {!active.request_incoming && (
              <form className="dm-composer" onSubmit={send}>
                {replyTo && (
                  <div className="dm-composer-reply">
                    <div>
                      <b>Replying to</b>
                      <span>
                        {replyTo.body ||
                          replyTo.message_type.replace("_", " ")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                    >
                      ×
                    </button>
                  </div>
                )}

                <div className="dm-compose-row">
                  <button
                    type="button"
                    className="dm-compose-icon"
                    onClick={() => fileRef.current?.click()}
                    aria-label="Attach image, video, audio or file"
                  >
                    ＋
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    hidden
                    accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/webm,audio/mpeg,audio/mp4,application/pdf,text/plain"
                    onChange={(event) => void attach(event)}
                  />
                  <button
                    type="button"
                    className="dm-compose-icon"
                    onClick={() => setText((value) => value + " ❤️")}
                    aria-label="Add emoji"
                  >
                    ☺
                  </button>
                  <textarea
                    value={text}
                    rows={1}
                    onChange={(event) => updateTyping(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey
                      ) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                    placeholder="Message…"
                    aria-label="Message"
                  />
                  <button
                    className="send-button"
                    disabled={!text.trim() || sending}
                  >
                    <Icon name="send" size={18} />
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </section>

      {newMessageOpen && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-box dm-new-message-modal">
            <div className="modal-header">
              <div>
                <div className="eyebrow">NEW MESSAGE</div>
                <h2>Start a conversation</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => {
                  setNewMessageOpen(false);
                  setQuery("");
                }}
                aria-label="Close"
              >
                <Icon name="close" />
              </button>
            </div>

            <label className="dm-search">
              <Icon name="search" size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search username or name"
                autoFocus
              />
            </label>

            <div className="dm-user-results">
              {people.map((person) => (
                <button
                  key={person.id}
                  onClick={() => void startConversation(person)}
                >
                  <AvatarImage
                    src={avatarFor(person)}
                    alt={person.display_name}
                    size={80}
                  />
                  <span>
                    <b>{person.display_name}</b>
                    <small>@{person.username}</small>
                  </span>
                </button>
              ))}
              {people.length === 0 && (
                <p>No registered users match this search.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {viewer && (
        <div
          className="modal dm-media-viewer"
          role="dialog"
          aria-modal="true"
          onClick={() => setViewer("")}
        >
          <button
            className="icon-button"
            onClick={() => setViewer("")}
            aria-label="Close image"
          >
            <Icon name="close" />
          </button>
          <img src={viewer} alt="Message attachment" />
        </div>
      )}

      {notice && (
        <div className="toast" role="status">
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
    </div>
  );
}
