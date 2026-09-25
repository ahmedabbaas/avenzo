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
import VerifiedBadge from "../../social/components/verified-badge";
import UserMediaImage from "../../social/components/user-media-image";
import Icon from "../../social/components/icon";
import { avatarFor, formatRelativeTime } from "../../social/lib/profile";
import type { Profile } from "../../social/types";
import {
  acceptMessageRequest,
  blockUserFromMessages,
  deleteConversationForMe,
  deleteMessageForEveryone,
  deleteMessageRequest,
  editMessage,
  ensureConversation,
  fetchActiveNotes,
  fetchConversationMessages,
  fetchInbox,
  fetchMessageUsers,
  fetchMessagingPrivacy,
  getExistingConversation,
  hideMessageForMe,
  markMessageDelivered,
  markMessagesRead,
  reportMessage,
  reportUserFromMessages,
  restrictUser,
  sendDirectMessage,
  sendMessageAttachment,
  saveOwnNote,
  deleteOwnNote,
  setConversationMuted,
  setConversationTheme,
  setConversationFolder,
  setMessageReaction,
} from "../data";
import type {
  DirectMessage,
  InboxConversation,
  MessageNote,
  MessageReaction,
} from "../types";

const REACTIONS = ["❤️", "😂", "👍", "😮", "😢", "😡"];
const CHAT_THEMES: Array<{
  id: InboxConversation["theme"];
  label: string;
}> = [
  { id: "violet", label: "Violet" },
  { id: "ocean", label: "Ocean" },
  { id: "emerald", label: "Emerald" },
  { id: "sunset", label: "Sunset" },
  { id: "mono", label: "Mono" },
];
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
    verified: item.verified,
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

function recordingTime(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return minutes + ":" + String(seconds).padStart(2, "0");
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
  const [notes, setNotes] = useState<MessageNote[]>([]);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteAudience, setNoteAudience] =
    useState<MessageNote["audience"]>("followers");
  const [query, setQuery] = useState("");
  const [messageQuery, setMessageQuery] = useState("");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<DirectMessage | null>(null);
  const [tab, setTab] =
    useState<"primary" | "general" | "requests">("primary");
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<DirectMessage | null>(null);
  const [typing, setTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherAllowsOnline, setOtherAllowsOnline] = useState(false);
  const [ownOnlineEnabled, setOwnOnlineEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [notice, setNotice] = useState("");
  const [viewer, setViewer] = useState("");
  const [sharePending, setSharePending] = useState(
    sharePostId || shareReelId || shareProfileId
  );
  const fileRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const cancelRecordingRef = useRef(false);
  const stickToBottomRef = useRef(true);
  const typingTimer = useRef<number | null>(null);
  const messageHoldTimerRef = useRef<number | null>(null);
  const messageHoldStartRef = useRef<{ x: number; y: number } | null>(null);
  const activeRef = useRef<InboxConversation | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null
  );

  const pendingShare = sharePending;

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "auto") => {
    const node = bodyRef.current;
    if (!node) return;

    window.requestAnimationFrame(() => {
      node.scrollTo({
        top: node.scrollHeight,
        behavior,
      });
    });
  }, []);

  function handleMessageScroll() {
    const node = bodyRef.current;
    if (!node) return;

    const distanceFromBottom =
      node.scrollHeight - node.scrollTop - node.clientHeight;

    stickToBottomRef.current = distanceFromBottom < 120;
  }

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => setNotice(""), 5200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function clearMessageHold() {
    if (messageHoldTimerRef.current !== null) {
      window.clearTimeout(messageHoldTimerRef.current);
      messageHoldTimerRef.current = null;
    }
    messageHoldStartRef.current = null;
  }

  function startMessageHold(message: DirectMessage, x: number, y: number) {
    clearMessageHold();
    if (message.deleted_for_everyone_at) return;

    messageHoldStartRef.current = { x, y };
    messageHoldTimerRef.current = window.setTimeout(() => {
      setActionMessage(message);
      messageHoldTimerRef.current = null;
      messageHoldStartRef.current = null;
      if ("vibrate" in navigator) {
        navigator.vibrate(18);
      }
    }, 420);
  }

  function moveMessageHold(x: number, y: number) {
    const start = messageHoldStartRef.current;
    if (!start) return;
    if (Math.abs(x - start.x) > 10 || Math.abs(y - start.y) > 10) {
      clearMessageHold();
    }
  }

  function openMessageActions(message: DirectMessage) {
    clearMessageHold();
    if (!message.deleted_for_everyone_at) {
      setActionMessage(message);
    }
  }

  const loadNotes = useCallback(async () => {
    setNotes(await fetchActiveNotes(supabase));
  }, [supabase]);

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
      const next = await fetchMessageUsers(
        supabase,
        currentUser.id,
        search
      );
      setPeople(next);
      return next;
    },
    [supabase, currentUser.id]
  );

  const loadConversation = useCallback(
    async (conversation: InboxConversation) => {
      setActive(conversation);
      stickToBottomRef.current = true;
      setMessages(
        await fetchConversationMessages(
          supabase,
          conversation.conversation_id
        )
      );

      if (!conversation.request_incoming) {
        await markMessagesRead(
          supabase,
          conversation.conversation_id
        );
      }

      const privacy = await fetchMessagingPrivacy(
        supabase,
        conversation.other_user_id
      );
      setOtherAllowsOnline(privacy.onlineStatus);
      await loadLists();
      window.setTimeout(() => scrollToLatest("auto"), 0);
    },
    [supabase, currentUser.id, loadLists, scrollToLatest]
  );

  useEffect(() => {
    let activeEffect = true;

    const timer = window.setTimeout(() => {
      void Promise.all([
        loadLists(),
        loadPeople(),
        loadNotes(),
        supabase
          .from("privacy_settings")
          .select("online_status")
          .eq("user_id", currentUser.id)
          .single(),
      ])
        .then(async ([, users, , privacyResult]) => {
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
    }, 0);

    return () => {
      activeEffect = false;
      window.clearTimeout(timer);
    };
  }, [
    currentUser.id,
    initialUsername,
    loadConversation,
    loadLists,
    loadPeople,
    loadNotes,
    supabase,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        void loadPeople(query).catch(() =>
          setNotice("User search is unavailable right now.")
        );
      },
      query.trim() ? 280 : 0
    );

    return () => window.clearTimeout(timer);
  }, [query, loadPeople]);

  useEffect(() => {
    if (!active || !stickToBottomRef.current) return;
    scrollToLatest("smooth");
  }, [active, messages.length, scrollToLatest]);

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
          await markMessageDelivered(supabase, incoming.id);

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
                incoming.conversation_id
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notes" },
        () => void loadNotes()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, currentUser.id, loadLists, loadNotes]);

  useEffect(() => {
    if (!active) {
      const timer = window.setTimeout(() => {
        setTyping(false);
        setOtherOnline(false);
      }, 0);
      return () => window.clearTimeout(timer);
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

    typingChannelRef.current = channel;

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
      if (typingChannelRef.current === channel) {
        typingChannelRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [
    active,
    currentUser.id,
    otherAllowsOnline,
    ownOnlineEnabled,
    supabase,
  ]);

  useEffect(() => {
    return () => {
      clearRecordingTimer();
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        cancelRecordingRef.current = true;
        mediaRecorderRef.current.stop();
      }
      stopRecordingStream();
    };
  }, []);

  function openOwnNote() {
    const own = notes.find((note) => note.user_id === currentUser.id);
    setNoteBody(own?.body || "");
    setNoteAudience(own?.audience || "followers");
    setNoteOpen(true);
  }

  async function saveNote() {
    const clean = noteBody.trim();
    if (!clean) {
      setNotice("Write something before sharing your Note.");
      return;
    }

    try {
      await saveOwnNote(
        supabase,
        currentUser.id,
        clean,
        noteAudience
      );
      setNoteOpen(false);
      await loadNotes();
      setNotice("Note shared for 24 hours.");
    } catch {
      setNotice("Could not share your Note.");
    }
  }

  async function removeNote() {
    try {
      await deleteOwnNote(supabase, currentUser.id);
      setNoteOpen(false);
      setNoteBody("");
      await loadNotes();
      setNotice("Note removed.");
    } catch {
      setNotice("Could not remove your Note.");
    }
  }

  async function openNoteConversation(note: MessageNote) {
    if (note.user_id === currentUser.id) {
      openOwnNote();
      return;
    }

    const person: Profile = {
      id: note.user_id,
      username: note.username,
      display_name: note.display_name,
      bio: "",
      avatar_url: note.avatar_url,
      verified: note.verified,
    };

    await startConversation(person);
  }

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
          verified: Boolean(person.verified),
          last_message: "",
          last_message_type: null,
          last_message_at: new Date().toISOString(),
          unread_count: 0,
          request_status: ensured.requestStatus as InboxConversation["request_status"],
          request_incoming: false,
          muted: false,
          theme: "violet" as InboxConversation["theme"],
          inbox_folder: "primary" as InboxConversation["inbox_folder"],
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
      stickToBottomRef.current = true;
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
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";

      setNotice(
        active.request_status === "pending"
          ? "Wait for this message request to be accepted before sending more."
          : detail.includes("MESSAGING_BLOCKED")
            ? "Messaging is unavailable because one of these accounts is blocked."
            : detail.includes("MESSAGES_NOT_ALLOWED")
              ? "This account is not accepting messages from you."
              : "Couldn’t send that message. Please try again."
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
      setSharePending("");
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

  function clearRecordingTimer() {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  function stopRecordingStream() {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  }

  async function sendVoiceBlob(blob: Blob, mimeType: string) {
    if (!active || active.request_incoming || cancelRecordingRef.current) {
      cancelRecordingRef.current = false;
      return;
    }

    if (blob.size === 0) {
      setNotice("Voice message was empty.");
      return;
    }

    if (blob.size > MAX_ATTACHMENT_BYTES) {
      setNotice("Voice message is too large.");
      return;
    }

    const extension = mimeType.includes("mp4") ? "m4a" : "webm";
    const file = new File(
      [blob],
      "voice-" + Date.now() + "." + extension,
      { type: mimeType || "audio/webm" }
    );

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
      stickToBottomRef.current = true;
      window.setTimeout(() => scrollToLatest("smooth"), 0);
    } catch {
      setNotice("Voice message could not be sent.");
    } finally {
      setSending(false);
      cancelRecordingRef.current = false;
    }
  }

  async function startVoiceRecording() {
    if (!active || active.request_incoming || sending || recording) return;

    if (active.request_status === "pending") {
      setNotice(
        "Wait for this message request to be accepted before sending a voice message."
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setNotice("Voice recording is not supported on this device.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];
      cancelRecordingRef.current = false;

      const preferredMime = MediaRecorder.isTypeSupported(
        "audio/webm;codecs=opus"
      )
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        clearRecordingTimer();
        stopRecordingStream();
        mediaRecorderRef.current = null;
        setRecording(false);
        setRecordingSeconds(0);

        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(recordingChunksRef.current, { type });
        recordingChunksRef.current = [];
        void sendVoiceBlob(blob, type);
      };

      recorder.start(250);
      setRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((value) => {
          const next = value + 1;
          if (next >= 120) {
            window.setTimeout(() => stopVoiceRecording(true), 0);
          }
          return next;
        });
      }, 1000);
    } catch {
      stopRecordingStream();
      setRecording(false);
      setNotice("Allow microphone access to record a voice message.");
    }
  }

  function stopVoiceRecording(sendRecording: boolean) {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    cancelRecordingRef.current = !sendRecording;
    recorder.stop();
  }

  function startAudioCall() {
    if (!active || active.request_incoming) return;

    if (active.request_status !== "accepted") {
      setNotice("The message request must be accepted before starting a call.");
      return;
    }

    window.dispatchEvent(
      new CustomEvent("avenzo:start-audio-call", {
        detail: {
          conversationId: active.conversation_id,
          otherUserId: active.other_user_id,
          username: active.username,
          displayName: active.display_name,
          avatarUrl: active.avatar_url,
        },
      })
    );
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
    await deleteMessageRequest(supabase, active.conversation_id);
    setActive(null);
    setMessages([]);
    await loadLists();
  }

  async function changeConversationTheme(
    theme: InboxConversation["theme"]
  ) {
    if (!active) return;

    const previous = active.theme;
    setActive({ ...active, theme });
    setThemeOpen(false);
    setMoreOpen(false);

    try {
      await setConversationTheme(supabase, active.conversation_id, theme);
      await loadLists();
    } catch {
      setActive({ ...active, theme: previous });
      setNotice("Chat theme could not be updated.");
    }
  }

  async function moveConversationFolder(
    folder: InboxConversation["inbox_folder"]
  ) {
    if (!active) return;

    const previous = active.inbox_folder;
    setActive({ ...active, inbox_folder: folder });
    setMoreOpen(false);

    try {
      await setConversationFolder(
        supabase,
        active.conversation_id,
        folder
      );
      setTab(folder);
      await loadLists();
      setNotice(
        folder === "general"
          ? "Conversation moved to General."
          : "Conversation moved to Primary."
      );
    } catch {
      setActive({ ...active, inbox_folder: previous });
      setNotice("Could not move this conversation.");
    }
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
    const clean = next.slice(0, 5000);
    setText(clean);
    if (!active) return;

    const channel = typingChannelRef.current;
    if (!channel) return;

    void channel.send({
      type: "broadcast",
      event: "typing",
      payload: {
        userId: currentUser.id,
        typing: clean.trim().length > 0,
      },
    });

    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      void channel.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: currentUser.id, typing: false },
      });
    }, 1200);
  }

  const ownNote = notes.find((note) => note.user_id === currentUser.id);
  const visibleNotes = [
    ...(ownNote ? [ownNote] : []),
    ...notes.filter((note) => note.user_id !== currentUser.id),
  ].slice(0, 12);

  const baseConversations =
    tab === "requests"
      ? requests
      : inbox.filter(
          (item) =>
            (item.inbox_folder || "primary") === tab
        );

  const shown = baseConversations.filter((item) =>
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

        <div className="dm-notes-row" aria-label="Notes">
          <button
            type="button"
            className="dm-note-item own"
            onClick={openOwnNote}
            aria-label={ownNote ? "Edit your Note" : "Create a Note"}
          >
            <span className="dm-note-bubble">
              {ownNote ? ownNote.body : "Share a note…"}
            </span>
            <span className="dm-note-avatar-wrap">
              <AvatarImage
                src={avatarFor(currentUser)}
                alt={currentUser.display_name}
                size={96}
              />
              <i>+</i>
            </span>
            <small>Your note</small>
          </button>

          {visibleNotes
            .filter((note) => note.user_id !== currentUser.id)
            .map((note) => (
              <button
                type="button"
                className="dm-note-item"
                key={note.user_id}
                onClick={() => void openNoteConversation(note)}
                aria-label={"Open " + note.display_name + " note"}
              >
                <span className="dm-note-bubble">{note.body}</span>
                <span className="dm-note-avatar-wrap">
                  <AvatarImage
                    src={avatarFor({
                      id: note.user_id,
                      username: note.username,
                      display_name: note.display_name,
                      bio: "",
                      avatar_url: note.avatar_url,
                      verified: note.verified,
                    })}
                    alt={note.display_name}
                    size={96}
                  />
                </span>
                <small>{note.display_name}</small>
              </button>
            ))}
        </div>

        <div className="dm-tabs" role="tablist">
          <button
            className={tab === "primary" ? "active" : ""}
            onClick={() => {
              setTab("primary");
              setActive(null);
            }}
          >
            Primary
          </button>
          <button
            className={tab === "general" ? "active" : ""}
            onClick={() => {
              setTab("general");
              setActive(null);
            }}
          >
            General
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
              tab === "requests"
                ? "Search requests"
                : tab === "general"
                  ? "Search General"
                  : "Search Primary"
            }
          />
        </label>

        {!active && notice && (
          <div className="dm-inline-notice" role="status" aria-live="polite">
            <span>{notice}</span>
            <button onClick={() => setNotice("")} aria-label="Dismiss message">
              <Icon name="close" size={14} />
            </button>
          </div>
        )}

        <div className="dm-conversation-list">
          {loading ? (
            <p className="dm-list-empty">Loading conversations…</p>
          ) : shown.length === 0 ? (
            <div className="dm-empty-state">
              <Icon name="messages" size={28} />
              <b>
                {tab === "requests"
                  ? "No message requests"
                  : tab === "general"
                    ? "No General chats"
                    : "No messages yet"}
              </b>
              <p>
                {tab === "requests"
                  ? "New requests from real users will appear here."
                  : tab === "general"
                    ? "Move lower-priority conversations here to keep Primary focused."
                    : "Start a conversation with another AVENZO user."}
              </p>
              {tab === "primary" && (
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
                    <small className="verified-line">@{item.username}<VerifiedBadge verified={item.verified} /></small>
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

      <section
        className={
          "dm-chat " +
          (!active ? "dm-mobile-hidden " : "") +
          (active ? "dm-theme-" + (active.theme || "violet") : "")
        }
      >
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
                  <span className="verified-line">@{active.username}<VerifiedBadge verified={active.verified} /></span>
                  {typing ? (
                    <span className="dm-head-typing"> · Typing…</span>
                  ) : (
                    otherAllowsOnline &&
                    (otherOnline ? " · Online" : " · Offline")
                  )}
                </small>
              </div>
              <Link
                className="btn secondary small dm-view-profile"
                href={"/u/" + encodeURIComponent(active.username)}
              >
                View Profile
              </Link>
              <button
                type="button"
                className="icon-button dm-call-button"
                onClick={startAudioCall}
                aria-label="Start audio call"
                title="Audio call"
              >
                <Icon name="phone" size={20} />
              </button>
              <button
                className="icon-button dm-head-search-button"
                onClick={() => setSearchOpen((value) => !value)}
                aria-label="Search messages"
              >
                <Icon name="search" size={19} />
              </button>
              <button
                className="icon-button dm-more-button"
                onClick={() => setMoreOpen((value) => !value)}
                aria-label="Conversation options"
              >
                <Icon name="more" size={20} />
              </button>

              {moreOpen && (
                <div className="dm-more-menu">
                  <button
                    onClick={() => {
                      setThemeOpen((value) => !value);
                      setMoreOpen(false);
                    }}
                  >
                    Chat theme
                  </button>
                  {!active.request_incoming && (
                    <button
                      onClick={() =>
                        void moveConversationFolder(
                          active.inbox_folder === "general"
                            ? "primary"
                            : "general"
                        )
                      }
                    >
                      {active.inbox_folder === "general"
                        ? "Move to Primary"
                        : "Move to General"}
                    </button>
                  )}
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

            {themeOpen && (
              <div className="dm-theme-panel" role="dialog" aria-label="Chat theme">
                <div className="dm-theme-panel-head">
                  <b>Chat theme</b>
                  <button
                    type="button"
                    onClick={() => setThemeOpen(false)}
                    aria-label="Close chat theme"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
                <div className="dm-theme-grid">
                  {CHAT_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      className={
                        "dm-theme-choice dm-theme-choice-" +
                        theme.id +
                        (active.theme === theme.id ? " active" : "")
                      }
                      onClick={() => void changeConversationTheme(theme.id)}
                    >
                      <span />
                      <b>{theme.label}</b>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={"dm-chat-tools " + (searchOpen ? "open" : "")}>
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

            <div
              className="dm-message-area"
              ref={bodyRef}
              onScroll={handleMessageScroll}
            >
              {filteredMessages.length === 0 ? (
                <div className="conversation-start">
                  <AvatarImage
                    src={avatarFor(activeProfile)}
                    alt={activeProfile.display_name}
                    size={96}
                  />
                  <b>{active.display_name}</b>
                  <span className="verified-line">@{active.username}<VerifiedBadge verified={active.verified} /></span>
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
                        onContextMenu={(event) => {
                          event.preventDefault();
                          openMessageActions(message);
                        }}
                        onPointerDown={(event) =>
                          startMessageHold(message, event.clientX, event.clientY)
                        }
                        onPointerMove={(event) =>
                          moveMessageHold(event.clientX, event.clientY)
                        }
                        onPointerUp={clearMessageHold}
                        onPointerCancel={clearMessageHold}
                        onPointerLeave={clearMessageHold}
                      >
                        {!own && (
                          <span className="dm-message-avatar" aria-hidden="true">
                            <AvatarImage
                              src={avatarFor(activeProfile)}
                              alt=""
                              size={56}
                            />
                          </span>
                        )}
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
                                      <UserMediaImage
                                        src={url}
                                        alt={attachment.file_name || "Image"}
                                        className="dm-message-image"
                                        loading="lazy"
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
                                  <div className="dm-shared-copy">
                                    <b>
                                      @{message.shared_post?.creator_username || "user"}
                                      <VerifiedBadge verified={message.shared_post?.creator_verified} />
                                    </b>
                                    <span>
                                      {message.shared_post?.caption ||
                                        "Shared an AVENZO post"}
                                    </span>
                                  </div>

                                  {message.shared_post?.media_path &&
                                    (message.shared_post.media_type === "video" ? (
                                      <video
                                        src={
                                          supabase.storage
                                            .from("media")
                                            .getPublicUrl(
                                              message.shared_post.media_path
                                            ).data.publicUrl
                                        }
                                        muted
                                        controls
                                        playsInline
                                        preload="metadata"
                                        className="dm-shared-media"
                                      />
                                    ) : (
                                      <UserMediaImage
                                        src={
                                          supabase.storage
                                            .from("media")
                                            .getPublicUrl(
                                              message.shared_post.media_path
                                            ).data.publicUrl
                                        }
                                        alt={
                                          message.shared_post.caption ||
                                          "Shared AVENZO post"
                                        }
                                        className="dm-shared-media"
                                        loading="lazy"
                                      />
                                    ))}

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
                                  <div className="dm-shared-copy">
                                    <b>
                                      @{message.shared_reel?.creator_username || "user"}
                                      <VerifiedBadge verified={message.shared_reel?.creator_verified} />
                                    </b>
                                    <span>
                                      {message.shared_reel?.caption ||
                                        "Shared an AVENZO reel"}
                                    </span>
                                  </div>

                                  {message.shared_reel?.media_path && (
                                    <video
                                      src={
                                        supabase.storage
                                          .from("media")
                                          .getPublicUrl(
                                            message.shared_reel.media_path
                                          ).data.publicUrl
                                      }
                                      muted
                                      controls
                                      playsInline
                                      preload="metadata"
                                      className="dm-shared-media"
                                    />
                                  )}

                                  <Link
                                    href={"/r/" + message.shared_reel_id}
                                    className="btn secondary small"
                                  >
                                    Open Reel
                                  </Link>
                                </div>
                              )}

                              {message.shared_profile_id && (
                                <div className="dm-shared-card dm-shared-profile">
                                  {message.shared_profile && (
                                    <AvatarImage
                                      src={avatarFor({
                                        id: message.shared_profile.id,
                                        username: message.shared_profile.username,
                                        display_name:
                                          message.shared_profile.display_name,
                                        bio: "",
                                        avatar_url:
                                          message.shared_profile.avatar_url,
                                      })}
                                      alt={message.shared_profile.display_name}
                                      size={84}
                                    />
                                  )}
                                  <div className="dm-shared-copy">
                                    <b>
                                      {message.shared_profile?.display_name ||
                                        "Shared profile"}
                                    </b>
                                    <span>
                                      @{message.shared_profile?.username || "user"}
                                      <VerifiedBadge verified={message.shared_profile?.verified} />
                                    </span>
                                  </div>
                                  {message.shared_profile && (
                                    <Link
                                      href={
                                        "/u/" +
                                        encodeURIComponent(
                                          message.shared_profile.username
                                        )
                                      }
                                      className="btn secondary small"
                                    >
                                      Open Profile
                                    </Link>
                                  )}
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
                            <button
                              type="button"
                              className="dm-message-menu-trigger"
                              onClick={() => openMessageActions(message)}
                              aria-label="Message options"
                              title="Message options"
                            >
                              •••
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {typing && !active.request_incoming && (
              <div className="dm-live-typing" aria-live="polite">
                <AvatarImage
                  src={avatarFor(activeProfile)}
                  alt=""
                  size={40}
                />
                <span className="dm-typing-bubble">
                  <i />
                  <i />
                  <i />
                </span>
                <small>{active.display_name} is typing</small>
              </div>
            )}

            {notice && (
              <div className="dm-inline-notice dm-chat-notice" role="status" aria-live="polite">
                <span>{notice}</span>
                <button onClick={() => setNotice("")} aria-label="Dismiss message">
                  <Icon name="close" size={14} />
                </button>
              </div>
            )}

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

                {recording && (
                  <div className="dm-recording-status" role="status">
                    <span className="dm-recording-dot" />
                    <b>{recordingTime(recordingSeconds)}</b>
                    <span>Recording voice message</span>
                    <button
                      type="button"
                      onClick={() => stopVoiceRecording(false)}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <div className="dm-compose-row">
                  <button
                    type="button"
                    className="dm-compose-icon dm-camera-button"
                    onClick={() => fileRef.current?.click()}
                    aria-label="Add photo or video"
                  >
                    <Icon name="camera" size={20} />
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    hidden
                    accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/webm,audio/mpeg,audio/mp4,application/pdf,text/plain"
                    onChange={(event) => void attach(event)}
                  />
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
                    placeholder={recording ? "Recording…" : "Message…"}
                    aria-label="Message"
                    disabled={recording}
                  />
                  <button
                    type="button"
                    className="dm-compose-icon dm-emoji-button"
                    onClick={() => setText((value) => value + " ❤️")}
                    aria-label="Add emoji"
                  >
                    <Icon name="smile" size={19} />
                  </button>
                  <button
                    type="button"
                    className="dm-compose-icon dm-attach-button"
                    onClick={() => fileRef.current?.click()}
                    aria-label="Attach file"
                  >
                    <Icon name="paperclip" size={19} />
                  </button>
                  {text.trim() ? (
                    <button
                      className="send-button dm-send-button"
                      disabled={sending || recording}
                      aria-label={sending ? "Sending message" : "Send message"}
                      title={sending ? "Sending…" : "Send"}
                    >
                      <Icon name="send" size={19} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={
                        "dm-compose-icon dm-voice-button" +
                        (recording ? " recording" : "")
                      }
                      disabled={sending}
                      onClick={() =>
                        recording
                          ? stopVoiceRecording(true)
                          : void startVoiceRecording()
                      }
                      aria-label={
                        recording
                          ? "Stop and send voice message"
                          : "Record voice message"
                      }
                      title={
                        recording
                          ? "Tap to send voice message"
                          : "Record voice message"
                      }
                    >
                      <Icon name="mic" size={19} />
                    </button>
                  )}
                </div>
              </form>
            )}
          </>
        )}
      </section>

      {noteOpen && (
        <div
          className="modal dm-note-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Your Note"
          onClick={() => setNoteOpen(false)}
        >
          <div
            className="dm-note-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dm-note-sheet-head">
              <div>
                <small>NOTE</small>
                <h3>{ownNote ? "Edit your Note" : "Share a Note"}</h3>
              </div>
              <button
                type="button"
                onClick={() => setNoteOpen(false)}
                aria-label="Close Note editor"
              >
                <Icon name="close" size={17} />
              </button>
            </div>

            <textarea
              value={noteBody}
              maxLength={80}
              rows={3}
              onChange={(event) => setNoteBody(event.target.value)}
              placeholder="Share a thought…"
              autoFocus
            />

            <div className="dm-note-sheet-meta">
              <span>{noteBody.length}/80</span>
              <label>
                Share with
                <select
                  value={noteAudience}
                  onChange={(event) =>
                    setNoteAudience(
                      event.target.value as MessageNote["audience"]
                    )
                  }
                >
                  <option value="followers">Followers</option>
                  <option value="close_friends">Close Friends</option>
                  <option value="everyone">Everyone</option>
                </select>
              </label>
            </div>

            <div className="dm-note-sheet-actions">
              {ownNote && (
                <button
                  type="button"
                  className="danger"
                  onClick={() => void removeNote()}
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                className="primary"
                onClick={() => void saveNote()}
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}

      {actionMessage && (
        <div
          className="modal dm-message-action-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Message actions"
          onClick={() => setActionMessage(null)}
        >
          <div
            className="dm-message-action-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dm-action-grabber" />
            <div className="dm-action-reactions" aria-label="React to message">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    const message = actionMessage;
                    setActionMessage(null);
                    void react(message, emoji);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="dm-action-list">
              <button
                type="button"
                onClick={() => {
                  setReplyTo(actionMessage);
                  setActionMessage(null);
                }}
              >
                Reply
              </button>

              {actionMessage.body && (
                <button
                  type="button"
                  onClick={() => {
                    const message = actionMessage;
                    setActionMessage(null);
                    void messageAction("copy", message);
                  }}
                >
                  Copy
                </button>
              )}

              {actionMessage.sender_id === currentUser.id &&
                actionMessage.message_type === "text" && (
                  <button
                    type="button"
                    onClick={() => {
                      const message = actionMessage;
                      setActionMessage(null);
                      void messageAction("edit", message);
                    }}
                  >
                    Edit
                  </button>
                )}

              <button
                type="button"
                onClick={() => {
                  const message = actionMessage;
                  setActionMessage(null);
                  void messageAction("delete_me", message);
                }}
              >
                Delete for me
              </button>

              {actionMessage.sender_id === currentUser.id ? (
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    const message = actionMessage;
                    setActionMessage(null);
                    void messageAction("delete_everyone", message);
                  }}
                >
                  Delete for everyone
                </button>
              ) : (
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    const message = actionMessage;
                    setActionMessage(null);
                    void messageAction("report", message);
                  }}
                >
                  Report
                </button>
              )}
            </div>

            <button
              type="button"
              className="dm-action-cancel"
              onClick={() => setActionMessage(null)}
              aria-label="Close message actions"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
                    <small className="verified-line">@{person.username}<VerifiedBadge verified={person.verified} /></small>
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
          <UserMediaImage
            src={viewer}
            alt="Message attachment"
            className="dm-viewer-image"
            loading="eager"
          />
        </div>
      )}

    </div>
  );
}
