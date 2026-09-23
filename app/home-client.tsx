"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import {
  fetchChats,
  fetchConversation,
  fetchExplorePosts,
  fetchFeedPosts,
  fetchPeopleAndFollowing,
  fetchProfile,
  fetchProfileStats,
  fetchReels,
  fetchSavedPostIds,
  fetchStories,
  fetchUnreadActivityCount,
  markConversationRead,
} from "../features/social/data/queries";
import ActivityPanel from "../features/social/components/activity-panel";
import AvatarImage from "../features/social/components/avatar-image";
import UserMediaImage from "../features/social/components/user-media-image";
import EmptyState from "../features/social/components/empty-state";
import MessagesPanel from "../features/social/components/messages-panel";
import ProfileView from "../features/social/components/profile-view";
import FeedSkeleton from "../features/social/components/feed-skeleton";
import Icon, { type IconName } from "../features/social/components/icon";
import PersonCard from "../features/social/components/person-card";
import PostCard from "../features/social/components/post-card";
import ReelCard from "../features/social/components/reel-card";
import PageTitle from "../features/social/components/page-title";
import SettingsPanel from "../features/social/components/settings-panel";
import {
  avatarFor,
  formatRelativeTime,
} from "../features/social/lib/profile";
import { readImageDimensions, type MediaDimensions } from "../features/social/lib/media";
import type {
  Chat,
  Message,
  Post,
  Profile,
  ProfileStats,
  Reel,
  Screen,
  Story,
} from "../features/social/types";

const NAV_ITEMS: Array<{ id: Screen; label: string; icon: IconName }> = [
  { id: "home", label: "Home", icon: "home" },
  { id: "explore", label: "Explore", icon: "explore" },
  { id: "messages", label: "Messages", icon: "messages" },
  { id: "activity", label: "Activity", icon: "activity" },
  { id: "saved", label: "Saved", icon: "saved" },
  { id: "profile", label: "Profile", icon: "profile" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export default function HomeClient({
  profile: initialProfile,
  initialChatUsername = "",
  initialScreen,
}: {
  profile: Profile;
  initialChatUsername?: string;
  initialScreen?: Screen;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState(initialProfile);
  const [screen, setScreen] = useState<Screen>(initialScreen || "home");
  const [posts, setPosts] = useState<Post[]>([]);
  const [explorePosts, setExplorePosts] = useState<Post[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [savedReels, setSavedReels] = useState<string[]>([]);
  const [storyViewer, setStoryViewer] = useState<Story | null>(null);
  const [createMode, setCreateMode] = useState<"post" | "reel" | "story">("post");
  const [people, setPeople] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [followed, setFollowed] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [mediaDimensions, setMediaDimensions] =
    useState<MediaDimensions | null>(null);
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

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

  const markActivityRead = useCallback(() => {
    setUnreadActivity(0);
  }, []);

  async function loadProfile() {
    const nextProfile = await fetchProfile(supabase, initialProfile.id);
    if (nextProfile) setProfile(nextProfile);
  }

  async function loadUnreadActivity() {
    setUnreadActivity(
      await fetchUnreadActivityCount(supabase, initialProfile.id)
    );
  }

  async function loadStats() {
    setStats(await fetchProfileStats(supabase, initialProfile.id));
  }

  async function loadPeople() {
    const result = await fetchPeopleAndFollowing(
      supabase,
      initialProfile.id
    );

    setPeople(result.people);
    setFollowed(result.followed);

    if (initialChatUsername) {
      const requested = result.people.find(
        (person) =>
          person.username.toLowerCase() === initialChatUsername
      );

      if (requested) {
        setScreen("messages");
        await openChat(requested);
      }
    }
  }

  async function loadSavedPosts() {
    setSaved(await fetchSavedPostIds(supabase, initialProfile.id));
  }

  async function loadPosts() {
    setPosts(await fetchFeedPosts(supabase, initialProfile.id));
  }

  async function loadExplorePosts() {
    setExplorePosts(
      await fetchExplorePosts(supabase, initialProfile.id)
    );
  }

  async function loadReels() {
    const result = await fetchReels(supabase, initialProfile.id);
    setReels(result.reels);
    setSavedReels(result.savedReels);
  }

  async function loadStories() {
    setStories(await fetchStories(supabase));
  }

  const loadChats = useCallback(async () => {
    setChats(await fetchChats(supabase, initialProfile.id));
  }, [supabase, initialProfile.id]);

  async function refreshEverything() {
    try {
      await Promise.all([
        loadProfile(),
        loadPeople(),
        loadPosts(),
        loadExplorePosts(),
        loadReels(),
        loadStories(),
        loadSavedPosts(),
        loadChats(),
        loadStats(),
        loadUnreadActivity(),
      ]);
    } catch {
      showToast(
        "Some AVENZO data could not be loaded. Refresh to try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function openChat(other: Profile) {
    setSelected(other);

    try {
      setMessages(
        await fetchConversation(
          supabase,
          initialProfile.id,
          other.id
        )
      );

      await markConversationRead(
        supabase,
        initialProfile.id,
        other.id
      );

      await loadChats();
    } catch {
      showToast("This conversation could not be loaded right now.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshEverything();
    }, 0);

    return () => window.clearTimeout(timer);

    // Initial account bootstrap is intentionally mount-only. Making the entire
    // loader graph reactive would refetch the full social shell after each state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [
    initialProfile.id,
    loadChats,
    screen,
    selected,
    showToast,
    supabase,
  ]);

  async function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] || null;

    if (preview) URL.revokeObjectURL(preview);

    if (!picked) {
      setFile(null);
      setPreview("");
      setMediaDimensions(null);
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
    setMediaDimensions(await readImageDimensions(picked));
  }

  async function createContent(event: FormEvent) {
    event.preventDefault();

    if (createMode === "story" && !file) {
      showToast("Choose an image or video for your story.");
      return;
    }

    if (createMode === "reel" && (!file || !file.type.startsWith("video/"))) {
      showToast("Reels require a video.");
      return;
    }

    if (createMode === "post" && !caption.trim() && !file) {
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
          "/" +
          (createMode === "reel"
            ? "reels"
            : createMode === "story"
              ? "stories"
              : "posts") +
          "/" +
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

      if (createMode === "story") {
        const { error } = await supabase.from("stories").insert({
          author_id: initialProfile.id,
          media_path: path,
          media_type: type,
          media_width: type === "image" ? mediaDimensions?.width || null : null,
          media_height: type === "image" ? mediaDimensions?.height || null : null,
        });
        if (error) throw error;
        showToast("Story published for 24 hours.");
      } else if (createMode === "reel") {
        const { error } = await supabase.from("reels").insert({
          author_id: initialProfile.id,
          caption: caption.trim(),
          media_path: path,
          media_type: "video",
        });
        if (error) throw error;
        showToast("Reel published.");
      } else {
        const { error } = await supabase.from("posts").insert({
          author_id: initialProfile.id,
          caption: caption.trim(),
          media_path: path,
          media_type: type,
          media_width: type === "image" ? mediaDimensions?.width || null : null,
          media_height: type === "image" ? mediaDimensions?.height || null : null,
        });
        if (error) throw error;
        showToast("Post published.");
      }

      setCaption("");
      setFile(null);
      setMediaDimensions(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview("");
      setShowCreate(false);

      await Promise.all([
        loadPosts(),
        loadExplorePosts(),
        loadReels(),
        loadStories(),
        loadStats(),
      ]);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Unable to publish content."
      );
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
    await Promise.all([loadPosts(), loadExplorePosts(), loadStats()]);
  }

  async function toggleLike(post: Post) {
    const update = (current: Post[]) =>
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
      );

    setPosts(update);
    setExplorePosts(update);

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
      await Promise.all([loadPosts(), loadExplorePosts()]);
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
      await Promise.all([loadPosts(), loadExplorePosts(), loadSavedPosts()]);
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

    await Promise.all([loadPosts(), loadExplorePosts()]);
  }

  async function toggleReelLike(reel: Reel) {
    setReels((current) =>
      current.map((item) =>
        item.id === reel.id
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

    const result = reel.liked
      ? await supabase
          .from("reel_likes")
          .delete()
          .eq("reel_id", reel.id)
          .eq("user_id", initialProfile.id)
      : await supabase
          .from("reel_likes")
          .insert({ reel_id: reel.id, user_id: initialProfile.id });

    if (result.error) {
      showToast("Could not update reel like.");
      await loadReels();
    }
  }

  async function toggleReelSave(reel: Reel) {
    const isSaved = savedReels.includes(reel.id);

    setSavedReels((current) =>
      isSaved
        ? current.filter((id) => id !== reel.id)
        : [...current, reel.id]
    );

    const result = isSaved
      ? await supabase
          .from("saved_reels")
          .delete()
          .eq("reel_id", reel.id)
          .eq("user_id", initialProfile.id)
      : await supabase
          .from("saved_reels")
          .insert({ reel_id: reel.id, user_id: initialProfile.id });

    if (result.error) {
      showToast("Could not update saved reels.");
      await loadReels();
    }
  }

  async function addReelComment(reel: Reel, body: string) {
    const clean = body.trim();
    if (!clean) return;

    const { error } = await supabase.from("reel_comments").insert({
      reel_id: reel.id,
      user_id: initialProfile.id,
      body: clean,
    });

    if (error) {
      showToast("Could not post reel comment.");
      return;
    }

    await loadReels();
  }

  async function deleteReel(reel: Reel) {
    if (reel.author_id !== initialProfile.id) return;
    if (!window.confirm("Delete this reel? This cannot be undone.")) return;

    const { error } = await supabase
      .from("reels")
      .delete()
      .eq("id", reel.id)
      .eq("author_id", initialProfile.id);

    if (error) {
      showToast("Could not delete reel.");
      return;
    }

    await supabase.storage.from("media").remove([reel.media_path]);
    showToast("Reel deleted.");
    await loadReels();
  }

  async function sharePost(post: Post) {
    const url = window.location.origin + "/p/" + post.id;
    try {
      if (navigator.share) {
        await navigator.share({
          title: post.profile?.display_name
            ? post.profile.display_name + " on AVENZO"
            : "AVENZO post",
          text: post.caption || "View this post on AVENZO",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        showToast("Post link copied.");
      }
    } catch {
      // User-cancelled shares do not need an error banner.
    }
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

    await Promise.all([loadStats(), loadPosts(), loadStories()]);
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
    router.replace("/login");
    router.refresh();
  }

  const filteredPeople = people.filter((person) =>
    (person.display_name + " " + person.username)
      .toLowerCase()
      .includes(query.toLowerCase().trim())
  );

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
          <AvatarImage src={avatarFor(profile)} className="avatar" alt={profile.display_name} size={72} />
          <span>@{profile.username}</span>
        </button>
      </header>

      <div className="social-layout">
        <aside className="left-nav" aria-label="Primary navigation">
          <div className="nav-identity">
            <AvatarImage src={avatarFor(profile)} alt={profile.display_name} size={96} />
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

          <button
            className="create-nav"
            onClick={() => {
              setCreateMode("post");
              setShowCreate(true);
            }}
          >
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
                <button
                  className="btn"
                  onClick={() => {
                    setCreateMode("post");
                    setShowCreate(true);
                  }}
                >
                  <Icon name="plus" size={17} />
                  Create post
                </button>
              </section>

              <div className="stories-row" aria-label="Active stories">
                <button
                  className="story story-you"
                  onClick={() => {
                    setCreateMode("story");
                    setShowCreate(true);
                  }}
                >
                  <span className="story-ring">
                    <AvatarImage src={avatarFor(profile)} alt={profile.display_name} size={96} />
                    <i>+</i>
                  </span>
                  <small>Add story</small>
                </button>

                {stories.map((story) => (
                  <button
                    className="story"
                    key={story.id}
                    onClick={() => setStoryViewer(story)}
                  >
                    <span className="story-ring">
                      <AvatarImage
                        src={avatarFor(story.profile || profile)}
                        alt={story.profile?.display_name || profile.display_name}
                        size={96}
                      />
                    </span>
                    <small>
                      @{story.profile?.username || profile.username}
                    </small>
                  </button>
                ))}
              </div>

              <div className="feed-toolbar">
                <div>
                  <div className="eyebrow">HOME FEED</div>
                  <strong>Posts from you and people you follow</strong>
                </div>
                <button
                  className="quiet-button"
                  onClick={() => void Promise.all([loadPosts(), loadStories()])}
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <FeedSkeleton />
              ) : posts.length === 0 ? (
                <EmptyState
                  title="Your feed is empty."
                  text="Create your first post or follow people to see their content."
                  action={() => {
                    setCreateMode("post");
                    setShowCreate(true);
                  }}
                  actionLabel="Create Post"
                  secondaryAction={() => setScreen("explore")}
                  secondaryActionLabel="Explore people"
                />
              ) : (
                posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    saved={saved.includes(post.id)}
                    mediaUrl={post.media_path ? mediaUrl(post.media_path) : ""}
                    onLike={() => void toggleLike(post)}
                    onSave={() => void toggleSave(post)}
                    onShare={() => void sharePost(post)}
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
                title="Explore"
                text="Real people and real content created inside AVENZO."
              />

              {query && (
                <div className="search-summary">
                  Results for <strong>“{query}”</strong>
                  <button onClick={() => setQuery("")}>Clear</button>
                </div>
              )}

              <section className="explore-section">
                <div className="section-inline-head">
                  <div>
                    <div className="eyebrow">PEOPLE</div>
                    <h3>Find people</h3>
                  </div>
                </div>

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
                        : "Real registered accounts will appear here as AVENZO grows."
                    }
                  />
                )}
              </section>

              <section className="explore-section">
                <div className="section-inline-head">
                  <div>
                    <div className="eyebrow">REELS</div>
                    <h3>Community reels</h3>
                  </div>
                  <button
                    className="btn secondary small"
                    onClick={() => {
                      setCreateMode("reel");
                      setShowCreate(true);
                    }}
                  >
                    Create Reel
                  </button>
                </div>

                {reels.length === 0 ? (
                  <EmptyState
                    title="No reels yet."
                    text="Reels will appear here only after real users upload videos."
                    action={() => {
                      setCreateMode("reel");
                      setShowCreate(true);
                    }}
                    actionLabel="Create Reel"
                  />
                ) : (
                  <div className="reels-grid">
                    {reels.map((reel) => (
                      <ReelCard
                        key={reel.id}
                        reel={reel}
                        mediaUrl={mediaUrl(reel.media_path)}
                        saved={savedReels.includes(reel.id)}
                        own={reel.author_id === initialProfile.id}
                        onLike={() => void toggleReelLike(reel)}
                        onSave={() => void toggleReelSave(reel)}
                        onComment={(body) => void addReelComment(reel, body)}
                        onDelete={() => void deleteReel(reel)}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="explore-section">
                <div className="section-inline-head">
                  <div>
                    <div className="eyebrow">POSTS</div>
                    <h3>Community posts</h3>
                  </div>
                </div>

                {explorePosts.length === 0 ? (
                  <EmptyState
                    title="No posts to explore yet."
                    text="Explore fills up naturally as real people publish posts."
                  />
                ) : (
                  explorePosts.map((post) => (
                    <PostCard
                      key={"explore-" + post.id}
                      post={post}
                      saved={saved.includes(post.id)}
                      mediaUrl={post.media_path ? mediaUrl(post.media_path) : ""}
                      onLike={() => void toggleLike(post)}
                      onSave={() => void toggleSave(post)}
                      onShare={() => void sharePost(post)}
                      onComment={(body) => void addComment(post, body)}
                      own={post.author_id === initialProfile.id}
                      onDelete={() => void deletePost(post)}
                    />
                  ))
                )}
              </section>
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
                  onShare={() => void sharePost(post)}
                  onComment={(body) => void addComment(post, body)}
                  own={post.author_id === initialProfile.id}
                  onDelete={() => void deletePost(post)}
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
            <ActivityPanel
              supabase={supabase}
              userId={initialProfile.id}
              onRead={markActivityRead}
            />
          )}

          {screen === "profile" && (
            <ProfileView
              profile={profile}
              posts={posts.filter((post) => post.author_id === profile.id)}
              reels={reels.filter((reel) => reel.author_id === profile.id)}
              media={mediaUrl}
              stats={stats}
              onEdit={() => setScreen("settings")}
              onCreatePost={() => {
                setCreateMode("post");
                setShowCreate(true);
              }}
              onCreateReel={() => {
                setCreateMode("reel");
                setShowCreate(true);
              }}
              onCreateStory={() => {
                setCreateMode("story");
                setShowCreate(true);
              }}
            />
          )}

          {screen === "settings" && (
            <SettingsPanel
              profile={profile}
              setProfile={setProfile}
              supabase={supabase}
              signOut={signOut}
              onSaved={() => {
                void loadProfile();
                showToast("Profile updated.");
              }}
              onUnblocked={() => {
                void Promise.all([
                  loadPeople(),
                  loadPosts(),
                  loadExplorePosts(),
                  loadReels(),
                  loadStories(),
                ]);
              }}
            />
          )}

          {screen === "messages" && (
            <MessagesPanel
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
              <AvatarImage src={avatarFor(profile)} alt={profile.display_name} size={96} />
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
                  <Link className="mini-person-link" href={"/u/" + encodeURIComponent(person.username)}>
                    <AvatarImage src={avatarFor(person)} alt={person.display_name} size={72} />
                    <div>
                      <b>{person.display_name}</b>
                      <small>@{person.username}</small>
                    </div>
                  </Link>
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

        <button
          className="mobile-create"
          onClick={() => {
            setCreateMode("post");
            setShowCreate(true);
          }}
        >
          <span className="mobile-icon-wrap">
            <Icon name="plus" />
          </span>
          <small>Create</small>
        </button>
      </nav>

      {showCreate && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label={"Create " + createMode}
        >
          <form className="modal-box create-modal" onSubmit={createContent}>
            <div className="modal-header">
              <div>
                <div className="eyebrow">CREATE</div>
                <h2>
                  {createMode === "post"
                    ? "New post"
                    : createMode === "reel"
                      ? "New reel"
                      : "New story"}
                </h2>
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

            <div className="create-type-tabs" role="tablist" aria-label="Content type">
              {(["post", "reel", "story"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={createMode === mode ? "active" : ""}
                  onClick={() => {
                    setCreateMode(mode);
                    setCaption("");
                    setFile(null);
                    setMediaDimensions(null);
                    if (preview) URL.revokeObjectURL(preview);
                    setPreview("");
                  }}
                >
                  {mode === "post" ? "Post" : mode === "reel" ? "Reel" : "Story"}
                </button>
              ))}
            </div>

            <div className="composer-author">
              <AvatarImage src={avatarFor(profile)} alt={profile.display_name} size={96} />
              <div>
                <b>{profile.display_name}</b>
                <small>@{profile.username}</small>
              </div>
            </div>

            {createMode !== "story" && (
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value.slice(0, 2200))}
                placeholder={
                  createMode === "reel"
                    ? "Add a caption to your reel…"
                    : "What’s worth sharing?"
                }
                autoFocus
              />
            )}

            <div className="composer-meta">
              <label className="upload-button">
                <Icon name="camera" size={17} />
                {createMode === "reel"
                  ? "Choose video"
                  : createMode === "story"
                    ? "Choose story media"
                    : "Add photo or video"}
                <input
                  type="file"
                  accept={createMode === "reel" ? "video/*" : "image/*,video/*"}
                  onChange={pickFile}
                />
              </label>
              {createMode !== "story" && <span>{caption.length}/2200</span>}
            </div>

            {createMode === "story" && (
              <p className="create-hint">
                Stories are visible to you and your followers for 24 hours.
              </p>
            )}

            {createMode === "reel" && (
              <p className="create-hint">
                Reels are real uploaded videos. AVENZO never inserts demo reels.
              </p>
            )}

            {preview &&
              (file?.type.startsWith("video/") ? (
                <video src={preview} controls className="upload-preview" />
              ) : (
                <UserMediaImage
                  src={preview}
                  className="upload-preview"
                  alt={createMode === "story" ? "Story preview" : "Post preview"}
                  width={mediaDimensions?.width}
                  height={mediaDimensions?.height}
                  loading="eager"
                />
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
                {posting
                  ? "Publishing…"
                  : createMode === "post"
                    ? "Publish Post"
                    : createMode === "reel"
                      ? "Publish Reel"
                      : "Publish Story"}
              </button>
            </div>
          </form>
        </div>
      )}

      {storyViewer && (
        <div
          className="modal story-viewer-shell"
          role="dialog"
          aria-modal="true"
          aria-label="Story"
          onClick={() => setStoryViewer(null)}
        >
          <div className="story-viewer" onClick={(event) => event.stopPropagation()}>
            <div className="story-viewer-head">
              <div className="person-line">
                <AvatarImage
                  src={avatarFor(storyViewer.profile || profile)}
                  alt={storyViewer.profile?.display_name || profile.display_name}
                  size={80}
                />
                <div>
                  <b>
                    {storyViewer.profile?.display_name || profile.display_name}
                  </b>
                  <small>
                    @{storyViewer.profile?.username || profile.username} ·{" "}
                    {formatRelativeTime(storyViewer.created_at)}
                  </small>
                </div>
              </div>
              <button
                className="icon-button"
                onClick={() => setStoryViewer(null)}
                aria-label="Close story"
              >
                <Icon name="close" />
              </button>
            </div>

            {storyViewer.media_type === "video" ? (
              <video
                src={mediaUrl(storyViewer.media_path)}
                controls
                autoPlay
                playsInline
                className="story-viewer-media"
              />
            ) : (
              <UserMediaImage
                src={mediaUrl(storyViewer.media_path)}
                alt="Story"
                className="story-viewer-media"
                width={storyViewer.media_width}
                height={storyViewer.media_height}
                loading="eager"
              />
            )}

            <small className="story-expiry">
              Expires {new Date(storyViewer.expires_at).toLocaleString()}
            </small>
          </div>
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
