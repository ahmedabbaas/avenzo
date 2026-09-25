"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import BrandLogo from "../components/brand-logo";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import { fetchInbox } from "../features/messages/data";
import {
  createPostComment,
  createReelComment,
  publishContent,
  removePost,
  removeReel,
  setFollowing,
  setPostLike,
  setPostSaved,
  setPostReposted,
  setReelLike,
  setReelReposted,
  setReelSaved,
} from "../features/social/data/mutations";
import {
  fetchExplorePosts,
  fetchFeedPosts,
  fetchPeopleAndFollowing,
  fetchProfile,
  fetchProfilePosts,
  fetchProfileStats,
  fetchReels,
  fetchSavedPostIds,
  fetchStories,
  fetchUnreadActivityCount,
} from "../features/social/data/queries";
import ActivityPanel from "../features/social/components/activity-panel";
import AvatarImage from "../features/social/components/avatar-image";
import EmptyState from "../features/social/components/empty-state";
import ProfileView from "../features/social/components/profile-view";
import FeedSkeleton from "../features/social/components/feed-skeleton";
import Icon, { type IconName } from "../features/social/components/icon";
import PersonCard from "../features/social/components/person-card";
import PostCard from "../features/social/components/post-card";
import ReelCard from "../features/social/components/reel-card";
import PageTitle from "../features/social/components/page-title";
import CreateContentModal from "../features/social/components/create-content-modal";
import StoryViewer from "../features/social/components/story-viewer";
import SavedCollectionsPanel from "../features/social/components/saved-collections-panel";
import VerifiedBadge from "../features/social/components/verified-badge";
import { avatarFor } from "../features/social/lib/profile";
import { readMediaDimensions, type MediaDimensions } from "../features/social/lib/media";
import {
  validateContentFile,
  validateCoverFile,
  validateVerticalReelDimensions,
} from "../features/social/lib/upload-validation";
import { useRuntimePreferences } from "../features/settings/lib/runtime-preferences";
import { useUiTranslation } from "../features/settings/lib/i18n";
import type {
  Post,
  Profile,
  ProfileStats,
  Reel,
  Screen,
  Story,
} from "../features/social/types";

const NAV_ITEMS: Array<{
  id: Screen | "reels";
  label: string;
  icon: IconName;
}> = [
  { id: "home", label: "Home", icon: "home" },
  { id: "explore", label: "Explore", icon: "explore" },
  { id: "reels", label: "Reels", icon: "reels" },
  { id: "messages", label: "Messages", icon: "messages" },
  { id: "activity", label: "Activity", icon: "activity" },
  { id: "saved", label: "Saved", icon: "saved" },
  { id: "profile", label: "Profile", icon: "profile" },
];

export default function HomeClient({
  profile: initialProfile,
  initialScreen,
  initialCreateMode,
}: {
  profile: Profile;
  initialScreen?: Screen;
  initialCreateMode?: "post" | "reel" | "story";
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const runtimePreferences = useRuntimePreferences();
  const t = useUiTranslation();

  const [profile, setProfile] = useState(initialProfile);
  const [screen, setScreen] = useState<Screen>(initialScreen || "home");
  const [homeFeedMode, setHomeFeedMode] =
    useState<"following" | "for-you">("following");
  const [posts, setPosts] = useState<Post[]>([]);
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [explorePosts, setExplorePosts] = useState<Post[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [profileReels, setProfileReels] = useState<Reel[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [savedReels, setSavedReels] = useState<string[]>([]);
  const [storyViewer, setStoryViewer] = useState<Story | null>(null);
  const [createMode, setCreateMode] = useState<"post" | "reel" | "story">(
    initialCreateMode || "post"
  );
  const [people, setPeople] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [followed, setFollowed] = useState<string[]>([]);
  const [requested, setRequested] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(Boolean(initialCreateMode));
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [mentions, setMentions] = useState("");
  const [location, setLocation] = useState("");
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [postMedia, setPostMedia] = useState<Array<{
    file: File;
    preview: string;
    dimensions: MediaDimensions | null;
  }>>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [mediaDimensions, setMediaDimensions] =
    useState<MediaDimensions | null>(null);
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [toast, setToast] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const toastTimerRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadActivity, setUnreadActivity] = useState(0);
  const [stats, setStats] = useState<ProfileStats>({
    posts: 0,
    followers: 0,
    following: 0,
  });

  const mediaUrl = (path: string) =>
    supabase.storage.from("media").getPublicUrl(path).data.publicUrl;

  const storySequence = useMemo(() => {
    const groups = new Map<string, Story[]>();
    const authorOrder: string[] = [];

    for (const item of stories) {
      if (!groups.has(item.author_id)) {
        groups.set(item.author_id, []);
        authorOrder.push(item.author_id);
      }
      groups.get(item.author_id)?.push(item);
    }

    return authorOrder.flatMap((authorId) =>
      (groups.get(authorId) || [])
        .slice()
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
        )
    );
  }, [stories]);

  const storyViewerIndex = storyViewer
    ? storySequence.findIndex((item) => item.id === storyViewer.id)
    : -1;
  const storyAuthorStories = storyViewer
    ? storySequence.filter(
        (item) => item.author_id === storyViewer.author_id
      )
    : [];
  const storyAuthorPosition = storyViewer
    ? storyAuthorStories.findIndex((item) => item.id === storyViewer.id)
    : -1;

  function stepStory(delta: -1 | 1) {
    if (!storyViewer) return;

    const currentIndex = storySequence.findIndex(
      (item) => item.id === storyViewer.id
    );

    if (currentIndex < 0) {
      setStoryViewer(null);
      return;
    }

    const nextIndex = currentIndex + delta;

    if (nextIndex < 0) return;

    if (nextIndex >= storySequence.length) {
      setStoryViewer(null);
      return;
    }

    setStoryViewer(storySequence[nextIndex]);
  }

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }

    setToast(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToast("");
      toastTimerRef.current = null;
    }, 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
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
    setRequested(result.requested);
  }

  async function loadSavedPosts() {
    setSaved(await fetchSavedPostIds(supabase, initialProfile.id));
  }

  async function loadPosts() {
    setPosts(await fetchFeedPosts(supabase, initialProfile.id));
  }

  async function loadProfileContent() {
    const [ownPosts, ownReels] = await Promise.all([
      fetchProfilePosts(supabase, initialProfile.id),
      fetchReels(supabase, initialProfile.id, {
        authorId: initialProfile.id,
        limit: 120,
      }),
    ]);

    setProfilePosts(ownPosts);
    setProfileReels(ownReels.reels);
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

  function openStory(story: Story) {
    setStoryViewer(story);

    if (story.author_id !== initialProfile.id && !story.viewed) {
      setStories((current) =>
        current.map((item) =>
          item.id === story.id ? { ...item, viewed: true } : item
        )
      );
    }
  }

  const loadUnreadMessages = useCallback(async () => {
    const [inbox, requests] = await Promise.all([
      fetchInbox(supabase, false),
      fetchInbox(supabase, true),
    ]);

    setUnreadMessages(
      [...inbox, ...requests].reduce(
        (total, conversation) => total + Number(conversation.unread_count || 0),
        0
      )
    );
  }, [supabase]);

  async function refreshEverything() {
    try {
      await Promise.all([
        loadProfile(),
        loadPeople(),
        loadPosts(),
        loadProfileContent(),
        loadExplorePosts(),
        loadReels(),
        loadStories(),
        loadSavedPosts(),
        loadUnreadMessages(),
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
        () => {
          void loadUnreadMessages();
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
    loadUnreadMessages,
    screen,
    showToast,
    supabase,
  ]);

  function clearComposerMedia() {
    if (preview) URL.revokeObjectURL(preview);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    for (const item of postMedia) {
      URL.revokeObjectURL(item.preview);
    }
    setPostMedia([]);
    setFile(null);
    setPreview("");
    setCoverFile(null);
    setCoverPreview("");
    setMediaDimensions(null);
  }

  function resetComposer(nextMode: "post" | "reel" | "story" = createMode) {
    clearComposerMedia();
    setCreateMode(nextMode);
    setTitle("");
    setCaption("");
    setHashtags("");
    setMentions("");
    setLocation("");
    setCollaboratorIds([]);
    setUploadProgress(0);
  }

  function openComposer(nextMode: "post" | "reel" | "story") {
    resetComposer(nextMode);
    setShowCreate(true);
  }

  async function pickPostFiles(files: File[]) {
    for (const item of postMedia) {
      URL.revokeObjectURL(item.preview);
    }

    const selected = files.slice(0, 10);
    if (!selected.length) {
      setPostMedia([]);
      setFile(null);
      setPreview("");
      setMediaDimensions(null);
      return;
    }

    const next: Array<{
      file: File;
      preview: string;
      dimensions: MediaDimensions | null;
    }> = [];

    for (const picked of selected) {
      const validationError = validateContentFile(picked, "post");
      if (validationError) {
        for (const item of next) URL.revokeObjectURL(item.preview);
        showToast(validationError);
        return;
      }

      next.push({
        file: picked,
        preview: URL.createObjectURL(picked),
        dimensions: await readMediaDimensions(picked),
      });
    }

    setPostMedia(next);
    setFile(next[0]?.file || null);
    setPreview(next[0]?.preview || "");
    setMediaDimensions(next[0]?.dimensions || null);

    if (files.length > 10) {
      showToast("A carousel can contain up to 10 images.");
    }
  }

  async function pickFile(picked: File | null) {
    if (createMode === "post") {
      await pickPostFiles(picked ? [picked] : []);
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview("");

    if (!picked) {
      setFile(null);
      setPreview("");
      setMediaDimensions(null);
      return;
    }

    const validationError = validateContentFile(picked, createMode);
    if (validationError) {
      showToast(validationError);
      setFile(null);
      setPreview("");
      setMediaDimensions(null);
      return;
    }

    const dimensions = await readMediaDimensions(picked);
    if (createMode === "reel") {
      const verticalError = validateVerticalReelDimensions(dimensions);
      if (verticalError) {
        showToast(verticalError);
        setFile(null);
        setPreview("");
        setMediaDimensions(null);
        return;
      }
    }

    setFile(picked);
    setPreview(URL.createObjectURL(picked));
    setMediaDimensions(dimensions);
  }

  function pickCover(picked: File | null) {
    if (coverPreview) URL.revokeObjectURL(coverPreview);

    const validationError = validateCoverFile(picked);
    if (validationError) {
      showToast(validationError);
      setCoverFile(null);
      setCoverPreview("");
      return;
    }

    setCoverFile(picked);
    setCoverPreview(picked ? URL.createObjectURL(picked) : "");
  }

  async function createContent(event: FormEvent) {
    event.preventDefault();

    const validationError =
      validateContentFile(file, createMode) ||
      validateCoverFile(coverFile) ||
      (createMode === "reel"
        ? validateVerticalReelDimensions(mediaDimensions)
        : null);

    if (validationError) {
      showToast(validationError);
      return;
    }

    if (
      createMode === "post" &&
      !caption.trim() &&
      postMedia.length === 0
    ) {
      showToast("Add a caption or media before publishing.");
      return;
    }

    setPosting(true);
    setUploadProgress(0);

    try {
      await publishContent({
        supabase,
        userId: initialProfile.id,
        mode: createMode,
        title,
        caption,
        hashtags,
        mentions,
        location,
        file,
        coverFile,
        dimensions: mediaDimensions,
        postMedia:
          createMode === "post"
            ? postMedia.map((item) => ({
                file: item.file,
                dimensions: item.dimensions,
              }))
            : [],
        highQualityUploads: runtimePreferences.high_quality_uploads,
        collaboratorIds: createMode === "post" ? collaboratorIds : [],
        onProgress: setUploadProgress,
      });

      showToast(
        createMode === "story"
          ? "Story published for 24 hours."
          : createMode === "reel"
            ? "Reel published."
            : "Post published."
      );

      resetComposer(createMode);
      setShowCreate(false);

      await Promise.all([
        loadPosts(),
        loadProfileContent(),
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
    if (
      runtimePreferences.confirm_delete_content &&
      !window.confirm("Delete this post? This cannot be undone.")
    ) return;

    try {
      await removePost(supabase, initialProfile.id, post);
      showToast("Post deleted.");
      await Promise.all([
        loadPosts(),
        loadProfileContent(),
        loadExplorePosts(),
        loadStats(),
      ]);
    } catch {
      showToast("Could not delete post.");
    }
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

    try {
      await setPostLike(
        supabase,
        initialProfile.id,
        post.id,
        post.liked
      );
    } catch {
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

    try {
      await setPostSaved(
        supabase,
        initialProfile.id,
        post.id,
        isSaved
      );
    } catch {
      showToast("Could not update saved posts.");
      await Promise.all([loadPosts(), loadExplorePosts(), loadSavedPosts()]);
    }
  }

  async function addComment(post: Post, body: string) {
    const clean = body.trim();
    if (!clean) return;

    try {
      await createPostComment(
        supabase,
        initialProfile.id,
        post.id,
        clean
      );
      await Promise.all([loadPosts(), loadExplorePosts()]);
    } catch {
      showToast("Could not post comment.");
    }
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

    try {
      await setReelLike(
        supabase,
        initialProfile.id,
        reel.id,
        reel.liked
      );
    } catch {
      showToast("Could not update reel like.");
      await Promise.all([loadReels(), loadProfileContent()]);
    }
  }

  async function toggleReelSave(reel: Reel) {
    const isSaved = savedReels.includes(reel.id);

    setSavedReels((current) =>
      isSaved
        ? current.filter((id) => id !== reel.id)
        : [...current, reel.id]
    );

    try {
      await setReelSaved(
        supabase,
        initialProfile.id,
        reel.id,
        isSaved
      );
    } catch {
      showToast("Could not update saved reels.");
      await loadReels();
    }
  }

  async function addReelComment(reel: Reel, body: string) {
    const clean = body.trim();
    if (!clean) return;

    try {
      await createReelComment(
        supabase,
        initialProfile.id,
        reel.id,
        clean
      );
      await loadReels();
    } catch {
      showToast("Could not post reel comment.");
    }
  }

  async function deleteReel(reel: Reel) {
    if (reel.author_id !== initialProfile.id) return;
    if (
      runtimePreferences.confirm_delete_content &&
      !window.confirm("Delete this reel? This cannot be undone.")
    ) return;

    try {
      await removeReel(supabase, initialProfile.id, reel);
      showToast("Reel deleted.");
      await Promise.all([loadReels(), loadProfileContent()]);
    } catch {
      showToast("Could not delete reel.");
    }
  }

  async function togglePostRepost(post: Post) {
    const wasReposted = Boolean(post.reposted);

    const update = (items: Post[]) =>
      items.map((item) =>
        item.id === post.id ? { ...item, reposted: !wasReposted } : item
      );

    setPosts(update);
    setExplorePosts(update);
    setProfilePosts(update);

    try {
      await setPostReposted(
        supabase,
        initialProfile.id,
        post.id,
        wasReposted
      );
      showToast(wasReposted ? "Repost removed." : "Reposted.");
    } catch {
      showToast("Could not update repost.");
      await Promise.all([loadPosts(), loadExplorePosts(), loadProfileContent()]);
    }
  }

  async function toggleReelRepost(reel: Reel) {
    const wasReposted = Boolean(reel.reposted);

    const update = (items: Reel[]) =>
      items.map((item) =>
        item.id === reel.id ? { ...item, reposted: !wasReposted } : item
      );

    setReels(update);
    setProfileReels(update);

    try {
      await setReelReposted(
        supabase,
        initialProfile.id,
        reel.id,
        wasReposted
      );
      showToast(wasReposted ? "Repost removed." : "Reposted.");
    } catch {
      showToast("Could not update repost.");
      await Promise.all([loadReels(), loadProfileContent()]);
    }
  }

  async function sharePost(post: Post) {
    router.push(
      "/messages?sharePost=" + encodeURIComponent(post.id)
    );
  }

  function shareReel(reel: Reel) {
    router.push(
      "/messages?shareReel=" + encodeURIComponent(reel.id)
    );
  }

  async function toggleFollow(other: Profile) {
    const isFollowing = followed.includes(other.id);
    const isRequested = requested.includes(other.id);
    const activeRelationship = isFollowing || isRequested;

    if (
      isFollowing &&
      runtimePreferences.confirm_unfollow &&
      !window.confirm(`Unfollow @${other.username}?`)
    ) {
      return;
    }

    try {
      const nextState = await setFollowing(
        supabase,
        initialProfile.id,
        other.id,
        activeRelationship
      );

      setFollowed((current) =>
        nextState === "following"
          ? [...new Set([...current, other.id])]
          : current.filter((id) => id !== other.id)
      );

      setRequested((current) =>
        nextState === "requested"
          ? [...new Set([...current, other.id])]
          : current.filter((id) => id !== other.id)
      );

      if (nextState === "requested") {
        showToast("Follow request sent.");
      } else if (isRequested && nextState === "none") {
        showToast("Follow request cancelled.");
      }

      await Promise.all([
        loadStats(),
        loadPosts(),
        loadStories(),
        loadPeople(),
      ]);
    } catch {
      showToast("Could not update follow right now.");
      await loadPeople();
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const normalizedQuery = query.toLowerCase().trim().replace(/^[@#]/, "");

  const filteredPeople = people.filter((person) =>
    !normalizedQuery ||
    (person.display_name + " " + person.username)
      .toLowerCase()
      .includes(normalizedQuery)
  );

  const filteredReels = reels.filter((reel) => {
    if (!normalizedQuery) return true;
    return [
      reel.title,
      reel.caption,
      reel.location,
      reel.profile?.display_name,
      reel.profile?.username,
      ...(reel.hashtags || []),
      ...(reel.mentions || []),
    ].filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery);
  });

  const filteredExplorePosts = explorePosts.filter((post) => {
    if (!normalizedQuery) return true;
    return [
      post.caption,
      post.location,
      post.profile?.display_name,
      post.profile?.username,
      ...(post.hashtags || []),
      ...(post.mentions || []),
    ].filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery);
  });

  const searchResultCount =
    filteredPeople.length + filteredReels.length + filteredExplorePosts.length;

  const homeFeedPosts =
    homeFeedMode === "following" ? posts : explorePosts;

  return (
    <div className={"social-app screen-" + screen}>
      <header className="top">
        <button
          className="mobile-home-create mobile-home-settings"
          onClick={() => router.push("/settings")}
          aria-label="Settings"
        >
          <Icon name="settings" size={23} />
        </button>

        <button
          className="brand"
          onClick={() => setScreen("home")}
          aria-label="AVENZO home"
        >
          {screen === "profile" ? (
            <span className="brand-profile-content">
              <span>@{profile.username}</span>
              <Icon name="chevronDown" size={15} />
            </span>
          ) : (
            <span className="brand-home-content">
              <BrandLogo size={34} />
              <span>AVENZO</span>
            </span>
          )}
        </button>

        <div className="search-wrap">
          <Icon name="search" size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && query.trim()) setScreen("explore");
            }}
            placeholder="Search people, posts, reels or #hashtags"
            aria-label="Search AVENZO"
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
          className="top-messages"
          onClick={() => router.push("/messages")}
          aria-label="Messages"
        >
          <Icon name="messages" size={20} />
          {unreadMessages > 0 && (
            <i className="top-badge">{Math.min(unreadMessages, 9)}</i>
          )}
        </button>

        <button
          className="top-create"
          onClick={() => openComposer("post")}
        >
          <Icon name="plus" size={17} />
          <span>Create a post</span>
        </button>

        <button
          className="top-profile-menu"
          onClick={() => router.push("/settings")}
          aria-label="Profile menu"
        >
          <Icon name="menu" size={22} />
        </button>

        <button
          className="top-profile"
          onClick={() => setScreen("profile")}
          aria-label="Open profile"
        >
          <AvatarImage src={avatarFor(profile)} className="avatar" alt={profile.display_name} size={72} />
          <span className="verified-line">@{profile.username}<VerifiedBadge verified={profile.verified} /></span>
        </button>
      </header>

      <div className="social-layout">
        <aside className="left-nav" aria-label="Primary navigation">
          <div className="nav-identity">
            <AvatarImage src={avatarFor(profile)} alt={profile.display_name} size={96} />
            <div>
              <strong>{profile.display_name}</strong>
              <small className="verified-line">@{profile.username}<VerifiedBadge verified={profile.verified} /></small>
            </div>
          </div>

          <div className="nav-profile-details">
            <div className="nav-profile-stats">
              <span>
                <b>{stats.posts}</b>
                <small>Posts</small>
              </span>
              <span>
                <b>{stats.followers}</b>
                <small>Followers</small>
              </span>
              <span>
                <b>{stats.following}</b>
                <small>Following</small>
              </span>
            </div>
            {profile.bio && <p>{profile.bio}</p>}
          </div>

          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={item.id !== "reels" && screen === item.id ? "active" : ""}
              onClick={() =>
                item.id === "messages"
                  ? router.push("/messages")
                  : item.id === "reels"
                    ? router.push("/reels")
                    : setScreen(item.id)
              }
            >
              <Icon name={item.icon} />
              <span>{t(item.label)}</span>
              {item.id === "messages" && unreadMessages > 0 && (
                <b className="nav-badge">{Math.min(unreadMessages, 99)}</b>
              )}
              {item.id === "activity" && unreadActivity > 0 && (
                <b className="nav-badge">{Math.min(unreadActivity, 99)}</b>
              )}
            </button>
          ))}

          <button onClick={() => router.push("/settings")}>
            <Icon name="settings" />
            <span>{t("Settings")}</span>
          </button>

          {profile.is_admin && (
            <button onClick={() => router.push("/admin/verification")}>
              <Icon name="profile" />
              <span>Verification Admin</span>
            </button>
          )}

          <button
            className="create-nav"
            onClick={() => {
              setCreateMode("post");
              setShowCreate(true);
            }}
          >
            <Icon name="plus" />
            <span>{t("Create post")}</span>
          </button>

          <button className="logout-nav" onClick={signOut}>
            <Icon name="logout" />
            <span>{t("Sign out")}</span>
          </button>
        </aside>

        <main className="social-main">
          {screen === "home" && (
            <>
              <section className="home-dashboard-head">
                <div>
                  <div className="eyebrow">REAL PEOPLE · REAL STORIES</div>
                  <h1>Stories</h1>
                  <p>Updates shared by real AVENZO accounts you can actually open and follow.</p>
                </div>
                <button
                  className="btn home-create-button"
                  onClick={() => openComposer("post")}
                >
                  <Icon name="plus" size={17} />
                  Create a post
                </button>
              </section>

              <div className="stories-row" aria-label="Active stories">
                <button
                  className="story story-you"
                  onClick={() => {
                    openComposer("story");
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
                    className={"story " + (story.viewed ? "viewed" : "unseen")}
                    key={story.id}
                    onClick={() => openStory(story)}
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
                      <VerifiedBadge verified={story.profile?.verified || profile.verified} />
                    </small>
                  </button>
                ))}
              </div>

              <div className="home-feed-modes" role="tablist" aria-label="Home feed">
                <button
                  type="button"
                  role="tab"
                  aria-selected={homeFeedMode === "following"}
                  className={homeFeedMode === "following" ? "active" : ""}
                  onClick={() => setHomeFeedMode("following")}
                >
                  Following
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={homeFeedMode === "for-you"}
                  className={homeFeedMode === "for-you" ? "active" : ""}
                  onClick={() => setHomeFeedMode("for-you")}
                >
                  For You
                </button>
              </div>

              <div className="feed-toolbar home-feed-toolbar">
                <div>
                  <div className="eyebrow">YOUR AVENZO</div>
                  <h2>Feed</h2>
                  <span>
                    {homeFeedMode === "following"
                      ? "Posts from you and people you follow."
                      : "Real public content across AVENZO."}
                  </span>
                </div>
                <button
                  className="quiet-button"
                  onClick={() =>
                    void Promise.all([
                      homeFeedMode === "following"
                        ? loadPosts()
                        : loadExplorePosts(),
                      loadStories(),
                    ])
                  }
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <FeedSkeleton />
              ) : homeFeedPosts.length === 0 ? (
                <EmptyState
                  title={
                    homeFeedMode === "following"
                      ? "Your feed is empty."
                      : "Nothing to discover yet."
                  }
                  text={
                    homeFeedMode === "following"
                      ? "Create your first post or follow people to see their content."
                      : "Public posts from real AVENZO users will appear here."
                  }
                  action={() => {
                    setCreateMode("post");
                    setShowCreate(true);
                  }}
                  actionLabel="Create Post"
                  secondaryAction={() => setScreen("explore")}
                  secondaryActionLabel="Explore people"
                />
              ) : (
                <div className="home-feed-grid">
                  {homeFeedPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      saved={saved.includes(post.id)}
                      mediaUrl={post.media_path ? mediaUrl(post.media_path) : ""}
                      onLike={() => void toggleLike(post)}
                      onSave={() => void toggleSave(post)}
                      onShare={() => void sharePost(post)}
                      onRepost={() => void togglePostRepost(post)}
                      onComment={(body) => void addComment(post, body)}
                      own={post.author_id === initialProfile.id}
                      onDelete={() => void deletePost(post)}
                      autoplayVideo={runtimePreferences.feed_autoplay_videos}
                      dataSaving={
                        runtimePreferences.data_saving_mode ||
                        runtimePreferences.use_less_mobile_data
                      }
                    />
                  ))}
                </div>
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
                  {searchResultCount} results for <strong>&quot;{query}&quot;</strong>
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
                      requested={requested.includes(person.id)}
                      onFollow={() => void toggleFollow(person)}
                      onMessage={() =>
                        router.push(
                          "/messages?user=" +
                            encodeURIComponent(person.username)
                        )
                      }
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
                  <div className="section-actions">
                    <button
                      className="btn secondary small"
                      onClick={() => router.push("/reels")}
                    >
                      Open Reels
                    </button>
                    <button
                      className="btn secondary small"
                      onClick={() => openComposer("reel")}
                    >
                      Create Reel
                    </button>
                  </div>
                </div>

                {filteredReels.length === 0 ? (
                  <EmptyState
                    title="No reels yet."
                    text="Reels will appear here only after real users upload videos."
                    action={() => {
                      openComposer("reel");
                    }}
                    actionLabel="Create Reel"
                  />
                ) : (
                  <div className="reels-grid">
                    {filteredReels.map((reel) => (
                      <ReelCard
                        key={reel.id}
                        reel={reel}
                        mediaUrl={mediaUrl(reel.media_path)}
                        coverUrl={reel.cover_path ? mediaUrl(reel.cover_path) : ""}
                        saved={savedReels.includes(reel.id)}
                        own={reel.author_id === initialProfile.id}
                        onLike={() => void toggleReelLike(reel)}
                        onSave={() => void toggleReelSave(reel)}
                        onComment={(body) => void addReelComment(reel, body)}
                        onShare={() => shareReel(reel)}
                        onRepost={() => void toggleReelRepost(reel)}
                        onDelete={() => void deleteReel(reel)}
                        autoplayVideo={runtimePreferences.media_autoplay_videos}
                        dataSaving={
                          runtimePreferences.data_saving_mode ||
                          runtimePreferences.use_less_mobile_data
                        }
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

                {filteredExplorePosts.length === 0 ? (
                  <EmptyState
                    title="No posts to explore yet."
                    text="Explore fills up naturally as real people publish posts."
                  />
                ) : (
                  filteredExplorePosts.map((post) => (
                    <PostCard
                      key={"explore-" + post.id}
                      post={post}
                      saved={saved.includes(post.id)}
                      mediaUrl={post.media_path ? mediaUrl(post.media_path) : ""}
                      onLike={() => void toggleLike(post)}
                      onSave={() => void toggleSave(post)}
                      onShare={() => void sharePost(post)}
                      onRepost={() => void togglePostRepost(post)}
                      onComment={(body) => void addComment(post, body)}
                      own={post.author_id === initialProfile.id}
                      onDelete={() => void deletePost(post)}
                      autoplayVideo={runtimePreferences.feed_autoplay_videos}
                      dataSaving={
                        runtimePreferences.data_saving_mode ||
                        runtimePreferences.use_less_mobile_data
                      }
                    />
                  ))
                )}
              </section>
            </>
          )}

          {screen === "saved" && (
            <SavedCollectionsPanel
              supabase={supabase}
              userId={initialProfile.id}
            />
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
              posts={profilePosts}
              reels={profileReels}
              media={mediaUrl}
              stats={stats}
              onEdit={() => router.push("/settings/account")}
              onCreatePost={() => openComposer("post")}
              onCreateReel={() => openComposer("reel")}
              onCreateStory={() => openComposer("story")}
            />
          )}


        </main>

        <aside className="right-rail">
          <div className="side-card side-profile-card">
            <div className="side-profile-top">
              <AvatarImage src={avatarFor(profile)} alt={profile.display_name} size={96} />
              <div>
                <strong>{profile.display_name}</strong>
                <small className="verified-line">@{profile.username}<VerifiedBadge verified={profile.verified} /></small>
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
              .filter(
                (person) =>
                  !followed.includes(person.id) &&
                  !requested.includes(person.id)
              )
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
            {people.filter(
              (person) =>
                !followed.includes(person.id) &&
                !requested.includes(person.id)
            ).length === 0 && (
              <p className="rail-empty">You&apos;re caught up with people here.</p>
            )}
          </div>

          <div className="product-note">
            <strong>AVENZO</strong>
            <span>Real accounts. Real conversations.</span>
          </div>
        </aside>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button
          className={screen === "home" ? "active" : ""}
          onClick={() => setScreen("home")}
          aria-label="Home"
        >
          <span className="mobile-icon-wrap"><Icon name="home" /></span>
          <small>Home</small>
        </button>

        <button
          className={screen === "explore" ? "active" : ""}
          onClick={() => setScreen("explore")}
          aria-label="Search"
        >
          <span className="mobile-icon-wrap"><Icon name="explore" /></span>
          <small>Search</small>
        </button>

        <button
          className="mobile-create"
          onClick={() => openComposer("post")}
          aria-label="Create"
        >
          <span className="mobile-icon-wrap"><Icon name="plus" /></span>
          <small>Create</small>
        </button>

        <button
          onClick={() => router.push("/reels")}
          aria-label="Reels"
        >
          <span className="mobile-icon-wrap"><Icon name="reels" /></span>
          <small>Reels</small>
        </button>

        <button
          className={screen === "profile" ? "active" : ""}
          onClick={() => setScreen("profile")}
          aria-label="Profile"
        >
          <span className="mobile-icon-wrap"><Icon name="profile" /></span>
          <small>Profile</small>
        </button>
      </nav>

      {showCreate && (
        <CreateContentModal
          profile={profile}
          mode={createMode}
          title={title}
          caption={caption}
          hashtags={hashtags}
          mentions={mentions}
          location={location}
          file={file}
          preview={preview}
          postPreviews={postMedia.map((item) => item.preview)}
          postDimensions={postMedia.map((item) => item.dimensions)}
          coverFile={coverFile}
          coverPreview={coverPreview}
          dimensions={mediaDimensions}
          posting={posting}
          uploadProgress={uploadProgress}
          people={people}
          collaboratorIds={collaboratorIds}
          onToggleCollaborator={(userId) =>
            setCollaboratorIds((current) =>
              current.includes(userId)
                ? current.filter((id) => id !== userId)
                : current.length < 3
                  ? [...current, userId]
                  : current
            )
          }
          onModeChange={(mode) => resetComposer(mode)}
          onTitleChange={setTitle}
          onCaptionChange={setCaption}
          onHashtagsChange={setHashtags}
          onMentionsChange={setMentions}
          onLocationChange={setLocation}
          onFileSelect={(nextFile) => void pickFile(nextFile)}
          onPostFilesSelect={(files) => void pickPostFiles(files)}
          onCoverSelect={pickCover}
          onClose={() => {
            resetComposer(createMode);
            setShowCreate(false);
          }}
          onSubmit={(event) => void createContent(event)}
        />
      )}

      {storyViewer && (
        <StoryViewer
          key={storyViewer.id}
          story={storyViewer}
          fallbackProfile={profile}
          currentUserId={initialProfile.id}
          mediaUrl={mediaUrl}
          onClose={() => setStoryViewer(null)}
          onPrevious={
            storyViewerIndex > 0
              ? () => stepStory(-1)
              : undefined
          }
          onNext={() => stepStory(1)}
          hasPrevious={storyViewerIndex > 0}
          position={storyAuthorPosition >= 0 ? storyAuthorPosition : 0}
          total={Math.max(1, storyAuthorStories.length)}
          onViewed={() => {
            setStories((current) =>
              current.map((item) =>
                item.id === storyViewer.id
                  ? { ...item, viewed: true }
                  : item
              )
            );
          }}
          autoplayVideo={runtimePreferences.media_autoplay_videos}
          dataSaving={
            runtimePreferences.data_saving_mode ||
            runtimePreferences.use_less_mobile_data
          }
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
