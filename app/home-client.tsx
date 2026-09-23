"use client";

import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "../lib/supabase/client";

type Screen =
  | "home"
  | "explore"
  | "messages"
  | "activity"
  | "saved"
  | "profile"
  | "settings";

type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  created_at?: string;
};

type Comment = {
  id: string;
  body: string;
  user_id: string;
  created_at: string;
  profile?: Profile;
};

type Post = {
  id: string;
  author_id: string;
  caption: string;
  media_path: string | null;
  media_type: "image" | "video" | null;
  created_at: string;
  profile?: Profile;
  likeCount: number;
  liked: boolean;
  commentCount: number;
  comments: Comment[];
};

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at?: string | null;
};

type Chat = {
  profile: Profile;
  last: string;
  updated: string;
  unread: number;
};

type ProfileStats = {
  posts: number;
  followers: number;
  following: number;
};

type IconName =
  | "home"
  | "explore"
  | "messages"
  | "activity"
  | "saved"
  | "profile"
  | "settings"
  | "plus"
  | "logout"
  | "search"
  | "heart"
  | "comment"
  | "bookmark"
  | "send"
  | "close"
  | "camera"
  | "back";

const NAV_ITEMS: Array<{ id: Screen; label: string; icon: IconName }> = [
  { id: "home", label: "Home", icon: "home" },
  { id: "explore", label: "Explore", icon: "explore" },
  { id: "messages", label: "Messages", icon: "messages" },
  { id: "activity", label: "Activity", icon: "activity" },
  { id: "saved", label: "Saved", icon: "saved" },
  { id: "profile", label: "Profile", icon: "profile" },
  { id: "settings", label: "Settings", icon: "settings" },
];

function Icon({ name, size = 19 }: { name: IconName; size?: number }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const paths: Record<IconName, React.ReactNode> = {
    home: (
      <>
        <path d="M3.5 10.5 12 3l8.5 7.5" />
        <path d="M5.5 9.5V21h13V9.5" />
        <path d="M9.5 21v-7h5v7" />
      </>
    ),
    explore: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z" />
      </>
    ),
    messages: (
      <>
        <path d="M4 5.5h16v11H9l-5 4v-15Z" />
        <path d="M8 9.5h8M8 13h5" />
      </>
    ),
    activity: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 8.5h18C21 15 18 15 18 8Z" />
        <path d="M9.5 20a3 3 0 0 0 5 0" />
      </>
    ),
    saved: <path d="M6.5 3.5h11v17L12 17l-5.5 3.5v-17Z" />,
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21c.8-4.2 3.2-6.2 7.5-6.2s6.7 2 7.5 6.2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    logout: (
      <>
        <path d="M10 5H5v14h5" />
        <path d="m14 8 4 4-4 4M18 12H9" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5" />
      </>
    ),
    heart: <path d="M20.5 9c0 5-8.5 10-8.5 10S3.5 14 3.5 9A4.5 4.5 0 0 1 12 6.8 4.5 4.5 0 0 1 20.5 9Z" />,
    comment: <path d="M4 5h16v11H9l-5 4V5Z" />,
    bookmark: <path d="M6.5 3.5h11v17L12 17l-5.5 3.5v-17Z" />,
    send: (
      <>
        <path d="m3.5 4 17 8-17 8 3-8-3-8Z" />
        <path d="M6.5 12h14" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    camera: (
      <>
        <path d="M4 7.5h4l1.3-2h5.4l1.3 2h4v11H4v-11Z" />
        <circle cx="12" cy="13" r="3.5" />
      </>
    ),
    back: (
      <>
        <path d="m15 5-7 7 7 7" />
        <path d="M8 12h12" />
      </>
    ),
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...common}>
      {paths[name]}
    </svg>
  );
}

function initialsAvatar(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="80" fill="#151a1e"/><circle cx="80" cy="80" r="78" fill="none" stroke="#dfff63" stroke-opacity=".4" stroke-width="2"/><text x="80" y="91" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="700" fill="#f6f7f8">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function avatarFor(profile: Profile) {
  return profile.avatar_url || initialsAvatar(profile.display_name);
}

function formatRelativeTime(value: string) {
  const time = new Date(value).getTime();
  const seconds = Math.max(1, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function HomeClient({
  profile: initialProfile,
}: {
  profile: Profile;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState(initialProfile);
  const [screen, setScreen] = useState<Screen>("home");
  const [feedTab, setFeedTab] = useState<"all" | "following">("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [followed, setFollowed] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [posting, setPosting] = useState(false);
  const [toast, setToast] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadActivity, setUnreadActivity] = useState(0);
  const [stats, setStats] = useState<ProfileStats>({
    posts: 0,
    followers: 0,
    following: 0,
  });

  const mediaUrl = (path: string) =>
    supabase.storage.from("media").getPublicUrl(path).data.publicUrl;

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  async function loadProfile() {
    const { data } = await supabase
      .from("profiles")
      .select("id,username,display_name,bio,avatar_url,created_at")
      .eq("id", initialProfile.id)
      .single();

    if (data) setProfile(data);
  }

  async function loadUnreadActivity() {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", initialProfile.id)
      .is("read_at", null);

    setUnreadActivity(count || 0);
  }

  async function loadStats() {
    const [postsCount, followersCount, followingCount] = await Promise.all([
      supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("author_id", initialProfile.id),
      supabase
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_id", initialProfile.id),
      supabase
        .from("follows")
        .select("following_id", { count: "exact", head: true })
        .eq("follower_id", initialProfile.id),
    ]);

    setStats({
      posts: postsCount.count || 0,
      followers: followersCount.count || 0,
      following: followingCount.count || 0,
    });
  }

  async function loadPeople() {
    const [{ data }, { data: followRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,username,display_name,bio,avatar_url,created_at")
        .neq("id", initialProfile.id)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", initialProfile.id),
    ]);

    setPeople(data || []);
    setFollowed((followRows || []).map((row: { following_id: string }) => row.following_id));
  }

  async function loadPosts() {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);

    const rows = (data || []) as Array<{
      id: string;
      author_id: string;
      caption: string;
      media_path: string | null;
      media_type: "image" | "video" | null;
      created_at: string;
    }>;

    const authorIds = [...new Set(rows.map((post) => post.author_id))];
    const postIds = rows.map((post) => post.id);

    const [{ data: authors }, { data: likes }, { data: comments }, { data: saveRows }] =
      await Promise.all([
        authorIds.length
          ? supabase
              .from("profiles")
              .select("id,username,display_name,bio,avatar_url,created_at")
              .in("id", authorIds)
          : Promise.resolve({ data: [] }),
        postIds.length
          ? supabase.from("likes").select("post_id,user_id").in("post_id", postIds)
          : Promise.resolve({ data: [] }),
        postIds.length
          ? supabase
              .from("comments")
              .select("id,post_id,user_id,body,created_at")
              .in("post_id", postIds)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [] }),
        supabase
          .from("saved_posts")
          .select("post_id")
          .eq("user_id", initialProfile.id),
      ]);

    const authorMap = new Map(
      ((authors || []) as Profile[]).map((author) => [author.id, author])
    );

    const commentRows = (comments || []) as Array<{
      id: string;
      post_id: string;
      user_id: string;
      body: string;
      created_at: string;
    }>;

    const commentUserIds = [...new Set(commentRows.map((comment) => comment.user_id))];
    const { data: commentUsers } = commentUserIds.length
      ? await supabase
          .from("profiles")
          .select("id,username,display_name,bio,avatar_url,created_at")
          .in("id", commentUserIds)
      : { data: [] };

    const commentUserMap = new Map(
      ((commentUsers || []) as Profile[]).map((user) => [user.id, user])
    );

    const likeRows = (likes || []) as Array<{ post_id: string; user_id: string }>;

    setPosts(
      rows.map((post) => ({
        ...post,
        profile: authorMap.get(post.author_id),
        likeCount: likeRows.filter((like) => like.post_id === post.id).length,
        liked: likeRows.some(
          (like) =>
            like.post_id === post.id && like.user_id === initialProfile.id
        ),
        commentCount: commentRows.filter(
          (comment) => comment.post_id === post.id
        ).length,
        comments: commentRows
          .filter((comment) => comment.post_id === post.id)
          .map((comment) => ({
            ...comment,
            profile: commentUserMap.get(comment.user_id),
          })),
      }))
    );

    setSaved(
      ((saveRows || []) as Array<{ post_id: string }>).map((row) => row.post_id)
    );
  }

  async function loadChats() {
    const filter = `sender_id.eq.${initialProfile.id},recipient_id.eq.${initialProfile.id}`;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(filter)
      .order("created_at", { ascending: false })
      .limit(300);

    const rows = (data || []) as Message[];
    const otherIds = [
      ...new Set(
        rows.map((item) =>
          item.sender_id === initialProfile.id
            ? item.recipient_id
            : item.sender_id
        )
      ),
    ];

    const { data: profiles } = otherIds.length
      ? await supabase
          .from("profiles")
          .select("id,username,display_name,bio,avatar_url,created_at")
          .in("id", otherIds)
      : { data: [] };

    const profileMap = new Map(
      ((profiles || []) as Profile[]).map((item) => [item.id, item])
    );

    const latest = new Map<string, Message>();
    rows.forEach((item) => {
      const other =
        item.sender_id === initialProfile.id
          ? item.recipient_id
          : item.sender_id;
      if (!latest.has(other)) latest.set(other, item);
    });

    const nextChats: Chat[] = [];
    for (const [id, latestMessage] of latest.entries()) {
      const otherProfile = profileMap.get(id);
      if (!otherProfile) continue;

      nextChats.push({
        profile: otherProfile,
        last: latestMessage.body,
        updated: latestMessage.created_at,
        unread: rows.filter(
          (item) =>
            item.sender_id === id &&
            item.recipient_id === initialProfile.id &&
            !item.read_at
        ).length,
      });
    }

    setChats(nextChats);
  }

  async function refreshEverything() {
    setLoading(true);
    await Promise.all([
      loadProfile(),
      loadPeople(),
      loadPosts(),
      loadChats(),
      loadStats(),
      loadUnreadActivity(),
    ]);
    setLoading(false);
  }

  async function openChat(other: Profile) {
    setSelected(other);

    const filter =
      `and(sender_id.eq.${initialProfile.id},recipient_id.eq.${other.id}),` +
      `and(sender_id.eq.${other.id},recipient_id.eq.${initialProfile.id})`;

    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(filter)
      .order("created_at", { ascending: true });

    setMessages((data || []) as Message[]);

    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("sender_id", other.id)
      .eq("recipient_id", initialProfile.id)
      .is("read_at", null);

    await loadChats();
  }

  useEffect(() => {
    void refreshEverything();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("avenzo-live-" + initialProfile.id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: "recipient_id=eq." + initialProfile.id,
        },
        (payload) => {
          const incoming = payload.new as Message;
          if (selected && incoming.sender_id === selected.id) {
            setMessages((current) => [...current, incoming]);
            void supabase
              .from("messages")
              .update({ read_at: new Date().toISOString() })
              .eq("id", incoming.id);
          }
          void loadChats();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: "recipient_id=eq." + initialProfile.id,
        },
        () => {
          if (screen !== "activity") {
            setUnreadActivity((current) => current + 1);
            showToast("You have new activity.");
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selected, screen]);

  function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] || null;

    if (preview) URL.revokeObjectURL(preview);

    if (!picked) {
      setFile(null);
      setPreview("");
      return;
    }

    const validType =
      picked.type.startsWith("image/") || picked.type.startsWith("video/");

    if (!validType) {
      showToast("Choose an image or video.");
      event.target.value = "";
      return;
    }

    if (picked.size > 25 * 1024 * 1024) {
      showToast("Media must be 25 MB or smaller.");
      event.target.value = "";
      return;
    }

    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  }

  async function createPost(event: FormEvent) {
    event.preventDefault();

    if (!caption.trim() && !file) {
      showToast("Add a caption or media before publishing.");
      return;
    }

    setPosting(true);

    try {
      let path: string | null = null;
      let type: "image" | "video" | null = null;

      if (file) {
        const extension =
          file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
          "bin";

        path =
          initialProfile.id +
          "/posts/" +
          crypto.randomUUID() +
          "." +
          extension.slice(0, 8);

        const upload = await supabase.storage.from("media").upload(path, file, {
          upsert: false,
          contentType: file.type,
        });

        if (upload.error) throw upload.error;
        type = file.type.startsWith("video/") ? "video" : "image";
      }

      const { error } = await supabase.from("posts").insert({
        author_id: initialProfile.id,
        caption: caption.trim(),
        media_path: path,
        media_type: type,
      });

      if (error) throw error;

      setCaption("");
      setFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview("");
      setShowCreate(false);
      showToast("Post published.");
      await Promise.all([loadPosts(), loadStats()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to publish post.");
    } finally {
      setPosting(false);
    }
  }

  async function deletePost(post: Post) {
    if (post.author_id !== initialProfile.id) return;
    if (!window.confirm("Delete this post? This cannot be undone.")) return;

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", post.id)
      .eq("author_id", initialProfile.id);

    if (error) {
      showToast("Could not delete post.");
      return;
    }

    if (post.media_path) {
      await supabase.storage.from("media").remove([post.media_path]);
    }

    showToast("Post deleted.");
    await Promise.all([loadPosts(), loadStats()]);
  }

  async function toggleLike(post: Post) {
    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? {
              ...item,
              liked: !item.liked,
              likeCount: Math.max(
                0,
                item.likeCount + (item.liked ? -1 : 1)
              ),
            }
          : item
      )
    );

    const result = post.liked
      ? await supabase
          .from("likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", initialProfile.id)
      : await supabase
          .from("likes")
          .insert({ post_id: post.id, user_id: initialProfile.id });

    if (result.error) {
      showToast("Could not update like.");
      await loadPosts();
    }
  }

  async function toggleSave(post: Post) {
    const isSaved = saved.includes(post.id);
    setSaved((current) =>
      isSaved
        ? current.filter((id) => id !== post.id)
        : [...current, post.id]
    );

    const result = isSaved
      ? await supabase
          .from("saved_posts")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", initialProfile.id)
      : await supabase
          .from("saved_posts")
          .insert({ post_id: post.id, user_id: initialProfile.id });

    if (result.error) {
      showToast("Could not update saved posts.");
      await loadPosts();
    }
  }

  async function addComment(post: Post, body: string) {
    const clean = body.trim();
    if (!clean) return;

    const { error } = await supabase.from("comments").insert({
      post_id: post.id,
      user_id: initialProfile.id,
      body: clean,
    });

    if (error) {
      showToast("Could not post comment.");
      return;
    }

    await loadPosts();
  }

  async function toggleFollow(other: Profile) {
    const isFollowing = followed.includes(other.id);

    setFollowed((current) =>
      isFollowing
        ? current.filter((id) => id !== other.id)
        : [...current, other.id]
    );

    const result = isFollowing
      ? await supabase
          .from("follows")
          .delete()
          .eq("follower_id", initialProfile.id)
          .eq("following_id", other.id)
      : await supabase.from("follows").insert({
          follower_id: initialProfile.id,
          following_id: other.id,
        });

    if (result.error) {
      showToast("Could not update follow.");
      await loadPeople();
      return;
    }

    await loadStats();
  }

  async function sendMessage() {
    const clean = message.trim();
    if (!selected || !clean) return;

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: initialProfile.id,
        recipient_id: selected.id,
        body: clean,
      })
      .select("*")
      .single();

    if (error) {
      showToast("Message could not be sent.");
      return;
    }

    setMessages((current) => [...current, data as Message]);
    setMessage("");
    await loadChats();
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const filteredPeople = people.filter((person) =>
    (person.display_name + " " + person.username)
      .toLowerCase()
      .includes(query.toLowerCase().trim())
  );

  const visiblePosts =
    feedTab === "following"
      ? posts.filter(
          (post) =>
            post.author_id === initialProfile.id ||
            followed.includes(post.author_id)
        )
      : posts;

  const unreadMessages = chats.reduce((total, chat) => total + chat.unread, 0);

  return (
    <div className="social-app">
      <header className="top">
        <button
          className="brand"
          onClick={() => setScreen("home")}
          aria-label="AVENZO home"
        >
          <i />
          AVENZO
        </button>

        <div className="search-wrap">
          <Icon name="search" size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && query.trim()) setScreen("explore");
            }}
            placeholder="Search people"
            aria-label="Search people"
          />
          {query && (
            <button
              className="search-clear"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <Icon name="close" size={15} />
            </button>
          )}
        </div>

        <button
          className="top-activity"
          onClick={() => setScreen("activity")}
          aria-label="Activity"
        >
          <Icon name="activity" size={20} />
          {unreadActivity > 0 && (
            <i className="top-badge">{Math.min(unreadActivity, 9)}</i>
          )}
        </button>

        <button
          className="top-profile"
          onClick={() => setScreen("profile")}
          aria-label="Open profile"
        >
          <img src={avatarFor(profile)} className="avatar" alt="" />
          <span>@{profile.username}</span>
        </button>
      </header>

      <div className="social-layout">
        <aside className="left-nav" aria-label="Primary navigation">
          <div className="nav-identity">
            <img src={avatarFor(profile)} alt="" />
            <div>
              <strong>{profile.display_name}</strong>
              <small>@{profile.username}</small>
            </div>
          </div>

          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={screen === item.id ? "active" : ""}
              onClick={() => setScreen(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.id === "messages" && unreadMessages > 0 && (
                <b className="nav-badge">{Math.min(unreadMessages, 99)}</b>
              )}
              {item.id === "activity" && unreadActivity > 0 && (
                <b className="nav-badge">{Math.min(unreadActivity, 99)}</b>
              )}
            </button>
          ))}

          <button className="create-nav" onClick={() => setShowCreate(true)}>
            <Icon name="plus" />
            <span>Create post</span>
          </button>

          <button className="logout-nav" onClick={signOut}>
            <Icon name="logout" />
            <span>Sign out</span>
          </button>
        </aside>

        <main className="social-main">
          {screen === "home" && (
            <>
              <section className="welcome">
                <div>
                  <div className="eyebrow">YOUR AVENZO</div>
                  <h1>Good to see you, {profile.display_name.split(" ")[0]}.</h1>
                  <p>
                    A quieter social space for real people, real posts and real
                    conversations.
                  </p>
                </div>
                <button className="btn" onClick={() => setShowCreate(true)}>
                  <Icon name="plus" size={17} />
                  Create post
                </button>
              </section>

              <div className="stories-row" aria-label="People">
                <button className="story story-you" onClick={() => setShowCreate(true)}>
                  <span className="story-ring">
                    <img src={avatarFor(profile)} alt="" />
                    <i>+</i>
                  </span>
                  <small>Your post</small>
                </button>
                {people.slice(0, 8).map((person) => (
                  <button
                    className="story"
                    key={person.id}
                    onClick={() => {
                      setQuery(person.username);
                      setScreen("explore");
                    }}
                  >
                    <span className="story-ring">
                      <img src={avatarFor(person)} alt="" />
                    </span>
                    <small>@{person.username}</small>
                  </button>
                ))}
              </div>

              <div className="feed-toolbar">
                <div className="feed-tabs" role="tablist" aria-label="Feed">
                  <button
                    className={feedTab === "all" ? "active" : ""}
                    onClick={() => setFeedTab("all")}
                  >
                    Latest
                  </button>
                  <button
                    className={feedTab === "following" ? "active" : ""}
                    onClick={() => setFeedTab("following")}
                  >
                    Following
                  </button>
                </div>
                <button className="quiet-button" onClick={() => void loadPosts()}>
                  Refresh
                </button>
              </div>

              {loading ? (
                <FeedSkeleton />
              ) : visiblePosts.length === 0 ? (
                <EmptyState
                  title={
                    feedTab === "following"
                      ? "Your following feed is quiet."
                      : "Your feed is ready for its first post."
                  }
                  text={
                    feedTab === "following"
                      ? "Follow people in Explore or switch back to Latest."
                      : "Publish something worth seeing or discover new people."
                  }
                  action={
                    feedTab === "following"
                      ? () => setScreen("explore")
                      : () => setShowCreate(true)
                  }
                  actionLabel={feedTab === "following" ? "Explore people" : "Create post"}
                />
              ) : (
                visiblePosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    saved={saved.includes(post.id)}
                    mediaUrl={post.media_path ? mediaUrl(post.media_path) : ""}
                    onLike={() => void toggleLike(post)}
                    onSave={() => void toggleSave(post)}
                    onComment={(body) => void addComment(post, body)}
                    own={post.author_id === initialProfile.id}
                    onDelete={() => void deletePost(post)}
                  />
                ))
              )}
            </>
          )}

          {screen === "explore" && (
            <>
              <PageTitle
                eyebrow="DISCOVER"
                title="Explore people"
                text="Find real AVENZO accounts and start a conversation."
              />

              {query && (
                <div className="search-summary">
                  Results for <strong>“{query}”</strong>
                  <button onClick={() => setQuery("")}>Clear</button>
                </div>
              )}

              <div className="people-grid">
                {filteredPeople.map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    following={followed.includes(person.id)}
                    onFollow={() => void toggleFollow(person)}
                    onMessage={() => {
                      void openChat(person);
                      setScreen("messages");
                    }}
                  />
                ))}
              </div>

              {!loading && filteredPeople.length === 0 && (
                <EmptyState
                  title={query ? "No people match that search." : "No other accounts yet."}
                  text={
                    query
                      ? "Try another username or display name."
                      : "AVENZO will show registered people here as the community grows."
                  }
                />
              )}
            </>
          )}

          {screen === "saved" && (
            <>
              <PageTitle
                eyebrow="COLLECTION"
                title="Saved posts"
                text="Private to your account."
              />
              {posts.filter((post) => saved.includes(post.id)).map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  saved
                  mediaUrl={post.media_path ? mediaUrl(post.media_path) : ""}
                  onLike={() => void toggleLike(post)}
                  onSave={() => void toggleSave(post)}
                  onComment={(body) => void addComment(post, body)}
                />
              ))}
              {!loading && saved.length === 0 && (
                <EmptyState
                  title="Nothing saved yet."
                  text="Save posts you want to return to later."
                />
              )}
            </>
          )}

          {screen === "activity" && (
            <Activity
              supabase={supabase}
              userId={initialProfile.id}
              onRead={() => setUnreadActivity(0)}
            />
          )}

          {screen === "profile" && (
            <ProfileView
              profile={profile}
              posts={posts.filter((post) => post.author_id === profile.id)}
              media={mediaUrl}
              stats={stats}
              onEdit={() => setScreen("settings")}
            />
          )}

          {screen === "settings" && (
            <Settings
              profile={profile}
              setProfile={setProfile}
              supabase={supabase}
              signOut={signOut}
              onSaved={() => {
                void loadProfile();
                showToast("Profile updated.");
              }}
            />
          )}

          {screen === "messages" && (
            <Messages
              people={filteredPeople}
              chats={chats}
              selected={selected}
              openChat={(person) => void openChat(person)}
              messages={messages}
              userId={initialProfile.id}
              text={message}
              setText={setMessage}
              send={() => void sendMessage()}
              onBack={() => setSelected(null)}
            />
          )}
        </main>

        <aside className="right-rail">
          <div className="side-card side-profile-card">
            <div className="side-profile-top">
              <img src={avatarFor(profile)} alt="" />
              <div>
                <strong>{profile.display_name}</strong>
                <small>@{profile.username}</small>
              </div>
            </div>
            <div className="mini-stats">
              <span>
                <b>{stats.posts}</b>
                posts
              </span>
              <span>
                <b>{stats.followers}</b>
                followers
              </span>
              <span>
                <b>{stats.following}</b>
                following
              </span>
            </div>
          </div>

          <div className="side-card">
            <div className="side-card-head">
              <b>People to follow</b>
              <button onClick={() => setScreen("explore")}>See all</button>
            </div>
            {people
              .filter((person) => !followed.includes(person.id))
              .slice(0, 4)
              .map((person) => (
                <div className="mini-person" key={person.id}>
                  <img src={avatarFor(person)} alt="" />
                  <div>
                    <b>{person.display_name}</b>
                    <small>@{person.username}</small>
                  </div>
                  <button onClick={() => void toggleFollow(person)}>Follow</button>
                </div>
              ))}
            {people.filter((person) => !followed.includes(person.id)).length === 0 && (
              <p className="rail-empty">You’re caught up with people here.</p>
            )}
          </div>

          <div className="product-note">
            <strong>AVENZO</strong>
            <span>Real accounts. Real conversations.</span>
          </div>
        </aside>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {[
          { id: "home" as Screen, label: "Home", icon: "home" as IconName },
          { id: "explore" as Screen, label: "Explore", icon: "explore" as IconName },
          { id: "messages" as Screen, label: "Messages", icon: "messages" as IconName },
          { id: "profile" as Screen, label: "Profile", icon: "profile" as IconName },
        ].map((item) => (
          <button
            key={item.id}
            className={screen === item.id ? "active" : ""}
            onClick={() => setScreen(item.id)}
          >
            <span className="mobile-icon-wrap">
              <Icon name={item.icon} />
              {item.id === "messages" && unreadMessages > 0 && (
                <i>{Math.min(unreadMessages, 9)}</i>
              )}
            </span>
            <small>{item.label}</small>
          </button>
        ))}

        <button className="mobile-create" onClick={() => setShowCreate(true)}>
          <span className="mobile-icon-wrap">
            <Icon name="plus" />
          </span>
          <small>Create</small>
        </button>
      </nav>

      {showCreate && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Create post">
          <form className="modal-box create-modal" onSubmit={createPost}>
            <div className="modal-header">
              <div>
                <div className="eyebrow">CREATE</div>
                <h2>New post</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowCreate(false)}
                aria-label="Close"
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="composer-author">
              <img src={avatarFor(profile)} alt="" />
              <div>
                <b>{profile.display_name}</b>
                <small>@{profile.username}</small>
              </div>
            </div>

            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value.slice(0, 2200))}
              placeholder="What’s worth sharing?"
              autoFocus
            />

            <div className="composer-meta">
              <label className="upload-button">
                <Icon name="camera" size={17} />
                Add photo or video
                <input type="file" accept="image/*,video/*" onChange={pickFile} />
              </label>
              <span>{caption.length}/2200</span>
            </div>

            {preview &&
              (file?.type.startsWith("video/") ? (
                <video src={preview} controls className="upload-preview" />
              ) : (
                <img src={preview} className="upload-preview" alt="Post preview" />
              ))}

            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button className="btn" disabled={posting}>
                {posting ? "Publishing…" : "Publish"}
              </button>
            </div>
          </form>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function PageTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="section-title">
      <div className="eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}

function EmptyState({
  title,
  text,
  action,
  actionLabel,
}: {
  title: string;
  text: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-mark">A</span>
      <b>{title}</b>
      <p>{text}</p>
      {action && actionLabel && (
        <button className="btn secondary" onClick={action}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="feed-skeleton" aria-label="Loading feed">
      {[0, 1].map((item) => (
        <div className="skeleton-card" key={item}>
          <div className="skeleton-head">
            <i />
            <span />
          </div>
          <div className="skeleton-media" />
          <div className="skeleton-lines">
            <i />
            <i />
          </div>
        </div>
      ))}
    </div>
  );
}

function PersonCard({
  person,
  following,
  onFollow,
  onMessage,
}: {
  person: Profile;
  following: boolean;
  onFollow: () => void;
  onMessage: () => void;
}) {
  return (
    <article className="person-card">
      <img className="person-avatar" src={avatarFor(person)} alt="" />
      <div className="person-copy">
        <b>{person.display_name}</b>
        <span>@{person.username}</span>
        <p>{person.bio || "New to AVENZO."}</p>
      </div>
      <div className="person-actions">
        <button className="btn small" onClick={onFollow}>
          {following ? "Following" : "Follow"}
        </button>
        <button className="btn secondary small" onClick={onMessage}>
          Message
        </button>
      </div>
    </article>
  );
}

function PostCard({
  post,
  saved,
  mediaUrl,
  onLike,
  onSave,
  onComment,
  own,
  onDelete,
}: {
  post: Post;
  saved: boolean;
  mediaUrl: string;
  onLike: () => void;
  onSave: () => void;
  onComment: (value: string) => void;
  own: boolean;
  onDelete: () => void;
}) {
  const [comment, setComment] = useState("");
  const author = post.profile;
  const authorName = author?.display_name || "AVENZO user";

  return (
    <article className="post-card">
      <div className="post-head">
        <div className="person-line">
          <img src={author ? avatarFor(author) : initialsAvatar(authorName)} alt="" />
          <div>
            <b>{authorName}</b>
            <small>
              @{author?.username || "user"} · {formatRelativeTime(post.created_at)}
            </small>
          </div>
        </div>
        {own && (
          <button className="post-delete" onClick={onDelete} aria-label="Delete post">
            Delete
          </button>
        )}
      </div>

      {post.caption && <p className="post-caption">{post.caption}</p>}

      {post.media_path && post.media_type === "image" && (
        <img className="post-media" src={mediaUrl} alt="Post media" loading="lazy" />
      )}

      {post.media_path && post.media_type === "video" && (
        <video
          className="post-media"
          src={mediaUrl}
          controls
          preload="metadata"
          playsInline
        />
      )}

      <div className="post-content">
        <div className="post-actions">
          <button
            className={post.liked ? "liked" : ""}
            onClick={onLike}
            aria-label={post.liked ? "Unlike post" : "Like post"}
          >
            <Icon name="heart" size={20} />
            <span>{post.likeCount}</span>
          </button>

          <span className="post-stat">
            <Icon name="comment" size={20} />
            <span>{post.commentCount}</span>
          </span>

          <button
            className={"save-action " + (saved ? "saved" : "")}
            onClick={onSave}
            aria-label={saved ? "Remove from saved" : "Save post"}
          >
            <Icon name="bookmark" size={20} />
          </button>
        </div>

        {post.comments.length > 0 && (
          <div className="comment-list">
            {post.comments.slice(-3).map((item) => (
              <div key={item.id}>
                <b>@{item.profile?.username || "user"}</b>
                <span>{item.body}</span>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!comment.trim()) return;
            onComment(comment);
            setComment("");
          }}
          className="comment-input"
        >
          <input
            value={comment}
            onChange={(event) => setComment(event.target.value.slice(0, 1000))}
            placeholder="Add a comment…"
            aria-label="Add a comment"
          />
          <button disabled={!comment.trim()}>Post</button>
        </form>
      </div>
    </article>
  );
}

function Messages({
  people,
  chats,
  selected,
  openChat,
  messages,
  userId,
  text,
  setText,
  send,
  onBack,
}: {
  people: Profile[];
  chats: Chat[];
  selected: Profile | null;
  openChat: (profile: Profile) => void;
  messages: Message[];
  userId: string;
  text: string;
  setText: (value: string) => void;
  send: () => void;
  onBack: () => void;
}) {
  const list = chats
    .map((chat) => chat.profile)
    .concat(
      people
        .filter((person) => !chats.some((chat) => chat.profile.id === person.id))
        .slice(0, 12)
    );

  const chatMap = new Map(chats.map((chat) => [chat.profile.id, chat]));

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className="chat">
      <div className={"chat-list " + (selected ? "mobile-hidden" : "")}>
        <div className="chat-list-title">
          <div>
            <div className="eyebrow">MESSAGES</div>
            <h3>Conversations</h3>
          </div>
        </div>

        {list.map((person) => {
          const chat = chatMap.get(person.id);
          return (
            <button
              className={"chat-user " + (selected?.id === person.id ? "active" : "")}
              key={person.id}
              onClick={() => openChat(person)}
            >
              <img src={avatarFor(person)} alt="" />
              <span>
                <b>{person.display_name}</b>
                <small>{chat?.last || "Start a conversation"}</small>
              </span>
              {chat?.unread ? <i className="chat-unread">{chat.unread}</i> : null}
            </button>
          );
        })}

        {list.length === 0 && (
          <p className="chat-list-empty">No people to message yet.</p>
        )}
      </div>

      <div className={"chat-main " + (!selected ? "mobile-hidden" : "")}>
        {selected ? (
          <>
            <div className="chat-head">
              <button
                className="chat-back"
                onClick={onBack}
                aria-label="Back to conversations"
              >
                <Icon name="back" size={19} />
              </button>
              <img src={avatarFor(selected)} alt="" />
              <div>
                <b>{selected.display_name}</b>
                <small>@{selected.username}</small>
              </div>
            </div>

            <div className="chat-body">
              {messages.length === 0 && (
                <div className="conversation-start">
                  <img src={avatarFor(selected)} alt="" />
                  <b>{selected.display_name}</b>
                  <span>@{selected.username}</span>
                  <p>Start the conversation.</p>
                </div>
              )}

              {messages.map((item) => (
                <div
                  key={item.id}
                  className={"message-row " + (item.sender_id === userId ? "me" : "")}
                >
                  <div className="bubble">{item.body}</div>
                  <small>{formatRelativeTime(item.created_at)}</small>
                </div>
              ))}
            </div>

            <div className="chat-compose">
              <input
                value={text}
                onChange={(event) => setText(event.target.value.slice(0, 5000))}
                onKeyDown={handleKeyDown}
                placeholder="Write a message…"
                aria-label="Message"
              />
              <button className="send-button" onClick={send} disabled={!text.trim()}>
                <Icon name="send" size={18} />
              </button>
            </div>
          </>
        ) : (
          <div className="empty chat-empty">
            <span className="empty-mark">A</span>
            <b>Your messages</b>
            <p>Choose a person to start a private conversation.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Activity({
  supabase,
  userId,
  onRead,
}: {
  supabase: any;
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

      const rows = data || [];
      const actorIds = [...new Set(rows.map((item: any) => item.actor_id))];

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
        rows.map((item: any) => ({
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

function ProfileView({
  profile,
  posts,
  media,
  stats,
  onEdit,
}: {
  profile: Profile;
  posts: Post[];
  media: (path: string) => string;
  stats: ProfileStats;
  onEdit: () => void;
}) {
  const mediaPosts = posts.filter((post) => post.media_path);

  return (
    <>
      <div className="profile-hero">
        <img src={avatarFor(profile)} alt="" />
        <div>
          <div className="profile-title-row">
            <div>
              <div className="eyebrow">@{profile.username}</div>
              <h1>{profile.display_name}</h1>
            </div>
            <button className="btn secondary small" onClick={onEdit}>
              Edit profile
            </button>
          </div>

          <p>{profile.bio || "Welcome to AVENZO."}</p>

          <div className="profile-stats">
            <span>
              <b>{stats.posts}</b> posts
            </span>
            <span>
              <b>{stats.followers}</b> followers
            </span>
            <span>
              <b>{stats.following}</b> following
            </span>
          </div>
        </div>
      </div>

      {mediaPosts.length > 0 ? (
        <div className="profile-grid">
          {mediaPosts.map((post) =>
            post.media_type === "video" ? (
              <video
                key={post.id}
                src={media(post.media_path!)}
                preload="metadata"
                controls
                muted
              />
            ) : (
              <img
                key={post.id}
                src={media(post.media_path!)}
                alt="Post"
                loading="lazy"
              />
            )
          )}
        </div>
      ) : (
        <EmptyState
          title="No media posts yet."
          text="Your photo and video posts will build your profile grid."
        />
      )}
    </>
  );
}

function Settings({
  profile,
  setProfile,
  supabase,
  signOut,
  onSaved,
}: {
  profile: Profile;
  setProfile: (profile: Profile) => void;
  supabase: any;
  signOut: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] || null;

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);

    if (!picked) {
      setAvatarFile(null);
      setAvatarPreview("");
      return;
    }

    if (!picked.type.startsWith("image/")) {
      setNotice("Profile picture must be an image.");
      event.target.value = "";
      return;
    }

    if (picked.size > 5 * 1024 * 1024) {
      setNotice("Profile picture must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setAvatarFile(picked);
    setAvatarPreview(URL.createObjectURL(picked));
    setNotice("");
  }

  async function save() {
    const cleanName = name.trim();
    const cleanBio = bio.trim();

    if (!cleanName || cleanName.length > 80) {
      setNotice("Display name must be 1–80 characters.");
      return;
    }

    if (cleanBio.length > 160) {
      setNotice("Bio must be 160 characters or less.");
      return;
    }

    setSaving(true);
    setNotice("");

    try {
      let avatarUrl = profile.avatar_url || "";

      if (avatarFile) {
        const extension =
          avatarFile.name
            .split(".")
            .pop()
            ?.toLowerCase()
            .replace(/[^a-z0-9]/g, "") || "jpg";

        const path =
          profile.id +
          "/avatars/" +
          crypto.randomUUID() +
          "." +
          extension.slice(0, 8);

        const upload = await supabase.storage
          .from("media")
          .upload(path, avatarFile, {
            upsert: false,
            contentType: avatarFile.type,
          });

        if (upload.error) throw upload.error;

        avatarUrl = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      }

      const { data, error } = await supabase
        .from("profiles")
        .update({
          display_name: cleanName,
          bio: cleanBio,
          avatar_url: avatarUrl,
        })
        .eq("id", profile.id)
        .select("id,username,display_name,bio,avatar_url,created_at")
        .single();

      if (error) throw error;

      setProfile(data);
      setAvatarFile(null);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview("");
      setNotice("Profile saved.");
      onSaved();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageTitle
        eyebrow="ACCOUNT"
        title="Profile settings"
        text="Control how your identity appears across AVENZO."
      />

      <div className="settings-card">
        <div className="settings-avatar">
          <img src={avatarPreview || avatarFor(profile)} alt="" />
          <label className="btn secondary small">
            Change picture
            <input type="file" accept="image/*" onChange={chooseAvatar} />
          </label>
        </div>

        <label>Username</label>
        <input value={"@" + profile.username} readOnly />
        <small className="field-note">Usernames are permanent after registration.</small>

        <label>Display name</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value.slice(0, 80))}
          maxLength={80}
        />

        <label>Bio</label>
        <textarea
          value={bio}
          onChange={(event) => setBio(event.target.value.slice(0, 160))}
          maxLength={160}
        />
        <small className="field-note">{bio.length}/160</small>

        <button className="btn" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>

        {notice && <p className="settings-notice">{notice}</p>}

        <div className="danger-zone">
          <div>
            <b>Sign out</b>
            <span>End this session on this device.</span>
          </div>
          <button className="btn secondary" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}
