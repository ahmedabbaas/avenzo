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
import MobileBottomNav from "../components/mobile-bottom-nav";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import { fetchInbox } from "../features/messages/data";
import {
  createPostComment,
  publishContent,
  removePost,
  removePostComment,
  reportPost,
  setFollowing,
  setPostCommentLike,
  setPostLike,
  setPostSaved,
  setPostReposted,
  setPostPollVote,
  setPostPinned,
  updatePostCaption,
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
import ExploreMediaGrid from "../features/social/components/explore-media-grid";
import ProfileView from "../features/social/components/profile-view";
import FeedSkeleton from "../features/social/components/feed-skeleton";
import Icon, { type IconName } from "../features/social/components/icon";
import PersonCard from "../features/social/components/person-card";
import PostCard from "../features/social/components/post-card";
import PageTitle from "../features/social/components/page-title";
import CreateContentModal from "../features/social/components/create-content-modal";
import StoryViewer from "../features/social/components/story-viewer";
import SavedCollectionsPanel from "../features/social/components/saved-collections-panel";
import VerifiedBadge from "../features/social/components/verified-badge";
import { avatarFor } from "../features/social/lib/profile";
import { readMediaDimensions, type MediaDimensions } from "../features/social/lib/media";
import {
  deleteContentDraft,
  listContentDrafts,
  saveContentDraft,
  type ContentDraft,
} from "../features/social/lib/content-drafts";
import {
  validateContentFile,
  validateCoverFile,
  validateVerticalReelDimensions,
} from "../features/social/lib/upload-validation";
import { useRuntimePreferences } from "../features/settings/lib/runtime-preferences";
import { useUiTranslation } from "../features/settings/lib/i18n";
import type {
  Comment,
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
  { id: "explore", label: "Discover", icon: "explore" },
  { id: "reels", label: "Clips", icon: "reels" },
  { id: "messages", label: "Messages", icon: "messages" },
  { id: "activity", label: "Activity", icon: "activity" },
  { id: "saved", label: "Saved", icon: "saved" },
  { id: "profile", label: "You", icon: "profile" },
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
    useState<"following" | "for-you">("for-you");
  const [posts, setPosts] = useState<Post[]>([]);
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [explorePosts, setExplorePosts] = useState<Post[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [profileReels, setProfileReels] = useState<Reel[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [storyViewer, setStoryViewer] = useState<Story | null>(null);
  const [createMode, setCreateMode] = useState<"post" | "reel" | "story">(
    initialCreateMode || "post"
  );
  const [people, setPeople] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [exploreFilter, setExploreFilter] = useState<
    "all" | "reels" | "photos" | "art" | "travel" | "gaming"
  >("all");
  const exploreSearchRef = useRef<HTMLInputElement | null>(null);
  const [followed, setFollowed] = useState<string[]>([]);
  const [requested, setRequested] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(Boolean(initialCreateMode));
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [mentions, setMentions] = useState("");
  const [location, setLocation] = useState("");
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollDurationHours, setPollDurationHours] = useState<number | null>(24);
  const [postMedia, setPostMedia] = useState<Array<{
    file: File;
    preview: string;
    dimensions: MediaDimensions | null;
    altText: string;
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
  const [exploreLoading, setExploreLoading] = useState(false);
  const loadedScreensRef = useRef(new Set<string>());
  const followingFeedLoadedRef = useRef(false);
  const [exploreError, setExploreError] = useState("");
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

  const loadDrafts = useCallback(async () => {
    try {
      setDrafts(await listContentDrafts(initialProfile.id));
    } catch {
      // Draft storage is device-local and should never block AVENZO.
    }
  }, [initialProfile.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDrafts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDrafts]);

  async function loadPosts() {
    const nextPosts = await fetchFeedPosts(supabase, initialProfile.id);
    setPosts(nextPosts);
    followingFeedLoadedRef.current = true;
  }

  async function loadProfileContent() {
    const [ownPosts, ownReels] = await Promise.all([
      fetchProfilePosts(supabase, initialProfile.id),
      fetchReels(supabase, initialProfile.id, {
        authorId: initialProfile.id,
        limit: 60,
      }),
    ]);

    setProfilePosts(ownPosts);
    setProfileReels(ownReels.reels);
  }

  async function loadExplorePosts() {
    const nextPosts = await fetchExplorePosts(supabase, initialProfile.id);
    setExplorePosts(nextPosts);
  }

  async function loadReels() {
    const result = await fetchReels(supabase, initialProfile.id);
    setReels(result.reels);
  }

  async function loadExploreData(showLoading = true) {
    if (showLoading) setExploreLoading(true);
    setExploreError("");

    try {
      await Promise.all([loadPeople(), loadExplorePosts(), loadReels()]);
    } catch {
      setExploreError("Could not load Explore right now. Please try again.");
    } finally {
      if (showLoading) setExploreLoading(false);
    }
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
      const criticalLoads: Promise<unknown>[] = [];

      if (screen === "home") {
        loadedScreensRef.current.add("home");
        criticalLoads.push(loadExplorePosts(), loadStories());
      } else if (screen === "profile") {
        loadedScreensRef.current.add("profile");
        criticalLoads.push(loadProfileContent(), loadStats());
      } else if (screen === "explore") {
        loadedScreensRef.current.add("explore");
        criticalLoads.push(loadExploreData());
      } else if (screen === "saved") {
        loadedScreensRef.current.add("saved");
        criticalLoads.push(loadSavedPosts());
      }

      await Promise.all(criticalLoads);
    } catch {
      showToast(
        "Some AVENZO data could not be loaded. Refresh to try again."
      );
    } finally {
      setLoading(false);
    }

    // Counters and the already-rendered profile are useful, but they should
    // never keep the first useful screen behind a loading skeleton.
    const loadSecondary = () => {
      void Promise.allSettled([
        loadProfile(),
        loadStats(),
        loadPeople(),
        followingFeedLoadedRef.current ? Promise.resolve() : loadPosts(),
        loadUnreadMessages(),
        loadUnreadActivity(),
      ]);
    };

    const idle = window.requestIdleCallback;
    if (typeof idle === "function") {
      idle(loadSecondary, { timeout: 900 });
    } else {
      globalThis.setTimeout(loadSecondary, 180);
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
    if (screen === "home" && !loadedScreensRef.current.has("home")) {
      loadedScreensRef.current.add("home");
      setLoading(true);
      void Promise.all([loadExplorePosts(), loadStories()]).finally(() => {
        setLoading(false);
      });
      return;
    }

    if (screen === "explore" && !loadedScreensRef.current.has("explore")) {
      loadedScreensRef.current.add("explore");
      void loadExploreData();
      return;
    }

    if (screen === "profile" && !loadedScreensRef.current.has("profile")) {
      loadedScreensRef.current.add("profile");
      void Promise.all([loadProfileContent(), loadStats()]);
      return;
    }

    if (screen === "saved" && !loadedScreensRef.current.has("saved")) {
      loadedScreensRef.current.add("saved");
      void loadSavedPosts();
    }

    // Screen loaders are intentionally one-shot per mounted social shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

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
    setPollQuestion("");
    setPollOptions(["", ""]);
    setPollDurationHours(24);
    setUploadProgress(0);
  }

  function openComposer(nextMode: "post" | "reel" | "story") {
    resetComposer(nextMode);
    setActiveDraftId(null);
    setShowCreate(true);
  }

  async function saveCurrentDraft() {
    const hasContent =
      Boolean(title.trim() || caption.trim() || hashtags.trim() || mentions.trim() || location.trim()) ||
      postMedia.length > 0 ||
      Boolean(file);

    if (!hasContent) {
      showToast("Add text or media before saving a draft.");
      return;
    }

    try {
      const savedDraft = await saveContentDraft({
        id: activeDraftId,
        userId: initialProfile.id,
        mode: createMode,
        title,
        caption,
        hashtags,
        mentions,
        location,
        collaboratorIds,
        pollQuestion,
        pollOptions,
        pollDurationHours,
        postMedia: postMedia.map((item) => ({
          file: item.file,
          dimensions: item.dimensions,
          altText: item.altText,
        })),
        file,
        coverFile,
        dimensions: mediaDimensions,
      });

      setActiveDraftId(savedDraft.id);
      await loadDrafts();
      showToast("Draft saved on this device.");
    } catch {
      showToast("Draft could not be saved on this device.");
    }
  }

  async function restoreContentDraft(draft: ContentDraft) {
    resetComposer(draft.mode);
    setCreateMode(draft.mode);
    setTitle(draft.title);
    setCaption(draft.caption);
    setHashtags(draft.hashtags);
    setMentions(draft.mentions);
    setLocation(draft.location);
    setCollaboratorIds(draft.collaboratorIds || []);
    setPollQuestion(draft.pollQuestion || "");
    setPollOptions(
      draft.pollOptions?.length >= 2 ? draft.pollOptions.slice(0, 4) : ["", ""]
    );
    setPollDurationHours(draft.pollDurationHours ?? 24);

    if (draft.mode === "post") {
      const restoredMedia = (draft.postMedia || []).map((item) => ({
        file: item.file,
        preview: URL.createObjectURL(item.file),
        dimensions: item.dimensions,
        altText: item.altText || "",
      }));
      setPostMedia(restoredMedia);
      setFile(restoredMedia[0]?.file || null);
      setPreview(restoredMedia[0]?.preview || "");
      setMediaDimensions(restoredMedia[0]?.dimensions || null);
    } else if (draft.file) {
      setFile(draft.file);
      setPreview(URL.createObjectURL(draft.file));
      setMediaDimensions(draft.dimensions || null);
    }

    if (draft.coverFile) {
      setCoverFile(draft.coverFile);
      setCoverPreview(URL.createObjectURL(draft.coverFile));
    }

    setActiveDraftId(draft.id);
    setShowCreate(true);
  }

  async function removeContentDraft(draftId: string) {
    try {
      await deleteContentDraft(draftId);
      if (activeDraftId === draftId) setActiveDraftId(null);
      await loadDrafts();
      showToast("Draft deleted.");
    } catch {
      showToast("Draft could not be deleted.");
    }
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
      altText: string;
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
        altText: "",
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

  async function replacePostFile(index: number, nextFile: File) {
    const nextDimensions = await readMediaDimensions(nextFile);

    setPostMedia((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        URL.revokeObjectURL(item.preview);
        return {
          ...item,
          file: nextFile,
          preview: URL.createObjectURL(nextFile),
          dimensions: nextDimensions,
        };
      })
    );

    if (index === 0) {
      if (preview) URL.revokeObjectURL(preview);
      setFile(nextFile);
      setPreview(URL.createObjectURL(nextFile));
      setMediaDimensions(nextDimensions);
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
    if (posting) return;

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
    setUploadProgress(2);

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
                altText: item.altText,
              }))
            : [],
        highQualityUploads: runtimePreferences.high_quality_uploads,
        collaboratorIds: createMode === "post" ? collaboratorIds : [],
        poll:
          createMode === "post" && pollQuestion.trim()
            ? {
                question: pollQuestion,
                options: pollOptions,
                durationHours: pollDurationHours,
              }
            : null,
        onProgress: setUploadProgress,
      });

      showToast(
        createMode === "story"
          ? "Story published for 24 hours."
          : createMode === "reel"
            ? "Reel published."
            : "Post published."
      );

      if (activeDraftId) {
        try {
          await deleteContentDraft(activeDraftId);
          setActiveDraftId(null);
          await loadDrafts();
        } catch {
          // Publishing succeeded; a stale local draft is harmless.
        }
      }

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

  async function addComment(
    post: Post,
    body: string,
    parentId: string | null = null
  ) {
    const clean = body.trim();
    if (!clean) return;

    try {
      await createPostComment(
        supabase,
        initialProfile.id,
        post.id,
        clean,
        parentId
      );
      await Promise.all([loadPosts(), loadExplorePosts(), loadProfileContent()]);
    } catch {
      showToast(parentId ? "Could not post reply." : "Could not post comment.");
    }
  }

  async function toggleCommentLike(post: Post, comment: Comment) {
    try {
      await setPostCommentLike(
        supabase,
        initialProfile.id,
        comment.id,
        Boolean(comment.liked)
      );
      await Promise.all([loadPosts(), loadExplorePosts(), loadProfileContent()]);
    } catch {
      showToast("Could not update comment like.");
    }
  }

  async function deleteComment(post: Post, comment: Comment) {
    if (comment.user_id !== initialProfile.id) return;
    if (
      runtimePreferences.confirm_delete_content &&
      !window.confirm("Delete this comment?")
    ) return;

    try {
      await removePostComment(supabase, initialProfile.id, comment.id);
      showToast("Comment deleted.");
      await Promise.all([loadPosts(), loadExplorePosts(), loadProfileContent()]);
    } catch {
      showToast("Could not delete comment.");
    }
  }

  async function editPostCaption(post: Post, nextCaption: string) {
    if (post.author_id !== initialProfile.id) return;

    try {
      await updatePostCaption(
        supabase,
        initialProfile.id,
        post.id,
        nextCaption
      );
      showToast("Caption updated.");
      await Promise.all([loadPosts(), loadExplorePosts(), loadProfileContent()]);
    } catch {
      showToast("Could not update caption.");
    }
  }

  async function submitPostReport(post: Post) {
    if (post.author_id === initialProfile.id) return;

    try {
      await reportPost(supabase, initialProfile.id, post.id);
      showToast("Report submitted for review.");
    } catch {
      showToast("Could not submit report.");
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

  async function sharePost(post: Post) {
    router.push(
      "/messages?sharePost=" + encodeURIComponent(post.id)
    );
  }

  async function voteOnPostPoll(post: Post, optionId: string) {
    if (!post.poll) return;

    try {
      await setPostPollVote(
        supabase,
        initialProfile.id,
        post.poll.id,
        optionId,
        post.poll.selectedOptionId
      );
      await Promise.all([loadPosts(), loadExplorePosts(), loadProfileContent()]);
    } catch {
      showToast("Could not update your poll vote.");
    }
  }

  async function togglePostPinned(post: Post) {
    try {
      await setPostPinned(supabase, post.id, !post.pinned_at);
      await loadProfileContent();
      if (screen === "home") {
        await Promise.allSettled([loadPosts(), loadExplorePosts()]);
      }
      showToast(post.pinned_at ? "Post unpinned." : "Post pinned to profile.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      showToast(
        message.includes("POST_PIN_LIMIT_REACHED")
          ? "You can pin up to 3 posts."
          : "Could not update pinned posts."
      );
    }
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

  function exploreText(
    item: Pick<Reel, "title" | "caption" | "location" | "hashtags" | "mentions" | "profile"> |
      Pick<Post, "caption" | "location" | "hashtags" | "mentions" | "profile">
  ) {
    return [
      "title" in item ? item.title : "",
      item.caption,
      item.location,
      item.profile?.display_name,
      item.profile?.username,
      ...(item.hashtags || []),
      ...(item.mentions || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function matchesExploreCategory(text: string) {
    if (exploreFilter === "art") {
      return /(^|\s|#)(art|artist|design|drawing|illustration|creative)(\s|$)/i.test(text);
    }
    if (exploreFilter === "travel") {
      return /(^|\s|#)(travel|trip|tour|vacation|nature|city|karachi|islamabad|lahore)(\s|$)/i.test(text);
    }
    if (exploreFilter === "gaming") {
      return /(^|\s|#)(gaming|game|gamer|games|playstation|xbox|pcgaming|esports)(\s|$)/i.test(text);
    }
    return true;
  }

  const filteredReels = reels.filter((reel) => {
    const text = exploreText(reel);
    if (normalizedQuery && !text.includes(normalizedQuery)) return false;
    if (exploreFilter === "photos") return false;
    return matchesExploreCategory(text);
  });

  const filteredExplorePosts = explorePosts.filter((post) => {
    const text = exploreText(post);
    if (normalizedQuery && !text.includes(normalizedQuery)) return false;
    if (exploreFilter === "reels") return false;
    if (
      exploreFilter === "photos" &&
      post.media_type !== "image" &&
      !(post.mediaItems || []).some((item) => item.media_type === "image")
    ) {
      return false;
    }
    return matchesExploreCategory(text);
  });

  const searchResultCount =
    (normalizedQuery ? filteredPeople.length : 0) +
    filteredReels.length +
    filteredExplorePosts.length;

  const homeFeedPosts =
    homeFeedMode === "following" ? posts : explorePosts;

  function selectPrimaryScreen(nextScreen: "home" | "explore" | "profile") {
    setScreen(nextScreen);

    const params = new URLSearchParams(window.location.search);
    params.set("screen", nextScreen);
    params.delete("create");
    params.delete("chat");
    const queryString = params.toString();

    window.history.replaceState(
      window.history.state,
      "",
      "/home" + (queryString ? "?" + queryString : "")
    );
  }

  return (
    <div className={"social-app screen-" + screen}>
      <header className="top">
        {screen === "home" && (
          <div className="avenzo-mobile-home-bar" style={{ display: "none" }}>
            <button
              type="button"
              className="avenzo-mobile-home-wordmark"
              onClick={() => selectPrimaryScreen("home")}
              aria-label="AVENZO home"
            >
              AVENZO
            </button>
            <div className="avenzo-mobile-home-actions">
              <button
                type="button"
                onClick={() => selectPrimaryScreen("explore")}
                aria-label="Search AVENZO"
              >
                <Icon name="search" size={21} />
              </button>
              <button
                type="button"
                onClick={() => router.push("/messages")}
                aria-label="Messages"
              >
                <Icon name="chatRound" size={20} />
                {unreadMessages > 0 && (
                  <span
                    className="avenzo-home-count-badge"
                    aria-label={unreadMessages + " unread messages"}
                  >
                    {Math.min(unreadMessages, 99)}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setScreen("activity");
                  setUnreadActivity(0);
                }}
                aria-label="Notifications"
              >
                <Icon name="bellModern" size={20} />
                {unreadActivity > 0 && (
                  <i
                    className="top-badge top-badge-dot"
                    aria-label="Unread notifications"
                  />
                )}
              </button>
            </div>
          </div>
        )}

        {screen === "profile" && (
          <div className="avenzo-mobile-profile-bar" style={{ display: "none" }}>
            <b className="avenzo-mobile-profile-username">
              @{profile.username}
            </b>
            <button
              type="button"
              className="avenzo-mobile-profile-settings"
              onClick={() => router.push("/settings")}
              aria-label="Settings"
            >
              <Icon name="settings" size={21} />
            </button>
          </div>
        )}

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
            <>
              <span className="brand-profile-content">
                <span>@{profile.username}</span>
                <Icon name="chevronDown" size={15} />
              </span>
              <span
                className="profile-reference-wordmark"
                style={{ display: "none" }}
              >
                AVENZO
              </span>
            </>
          ) : (
            <span className="brand-home-content">
              <BrandLogo size={34} />
              <span>AVENZO</span>
            </span>
          )}
        </button>

        <button
          className="mobile-home-search"
          style={{ display: "none" }}
          type="button"
          onClick={() => selectPrimaryScreen("explore")}
          aria-label="Search AVENZO"
        >
          <Icon name="search" size={21} />
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
          <Icon name="bellModern" size={20} />
          {unreadActivity > 0 && (
            <i
              className="top-badge top-badge-dot"
              aria-label="Unread notifications"
            />
          )}
        </button>

        <button
          className="top-messages"
          onClick={() => router.push("/messages")}
          aria-label="Messages"
        >
          <Icon name="chatRound" size={20} />
          {unreadMessages > 0 && (
            <i
              className="top-badge top-badge-dot"
              aria-label="Unread messages"
            />
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
          aria-label="Settings"
        >
          <Icon name="settings" size={21} />
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
                  <div className="eyebrow">AVENZO MOMENTS</div>
                  <h1>Moments</h1>
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

              <div className="stories-row" aria-label="Active moments">
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
                  <small>Add moment</small>
                </button>

                {stories.length === 0 && (
                  <div className="story-empty-inline">
                    <Icon name="camera" size={19} />
                    <span>
                      <b>No active stories</b>
                      <small>Stories from people you follow will appear here for 24 hours.</small>
                    </span>
                    <button type="button" onClick={() => openComposer("story")}>
                      Create story
                    </button>
                  </div>
                )}

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
                      <span className="story-label-desktop">
                        @{story.profile?.username || profile.username}
                        <VerifiedBadge verified={story.profile?.verified || profile.verified} />
                      </span>
                      <span
                        className="story-label-mobile"
                        style={{ display: "none" }}
                      >
                        {story.author_id === profile.id
                          ? "Your story"
                          : story.profile?.username || profile.username}
                      </span>
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
                  Inner Circle
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={homeFeedMode === "for-you"}
                  className={homeFeedMode === "for-you" ? "active" : ""}
                  onClick={() => setHomeFeedMode("for-you")}
                >
                  Pulse
                </button>
              </div>

              <div className="feed-toolbar home-feed-toolbar">
                <div>
                  <div className="eyebrow">AVENZO PULSE</div>
                  <h2>Pulse</h2>
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
                      onPollVote={(optionId) => void voteOnPostPoll(post, optionId)}
                      onComment={(body, parentId) =>
                        void addComment(post, body, parentId || null)
                      }
                      onCommentLike={(comment) =>
                        void toggleCommentLike(post, comment)
                      }
                      onCommentDelete={(comment) =>
                        void deleteComment(post, comment)
                      }
                      onEditCaption={(nextCaption) =>
                        void editPostCaption(post, nextCaption)
                      }
                      onReport={() => void submitPostReport(post)}
                      onPin={
                        post.author_id === initialProfile.id
                          ? () => void togglePostPinned(post)
                          : undefined
                      }
                      currentUserId={initialProfile.id}
                      own={post.author_id === initialProfile.id}
                      onDelete={() => void deletePost(post)}
                      autoplayVideo={runtimePreferences.feed_autoplay_videos}
                      dataSaving={
                        runtimePreferences.data_saving_mode ||
                        runtimePreferences.use_less_mobile_data
                      }
                      commentAvatarUrl={avatarFor(profile)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {screen === "explore" && (
            <section className="explore-page">
              <div className="avenzo-mobile-explore-head" style={{ display: "none" }}>
                <b>AVENZO</b>
                <div>
                  <button
                    type="button"
                    onClick={() => exploreSearchRef.current?.focus()}
                    aria-label="Search Explore"
                  >
                    <Icon name="search" size={21} />
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/messages")}
                    aria-label="Messages"
                  >
                    <Icon name="chatRound" size={20} />
                    {unreadMessages > 0 && (
                      <span className="explore-head-badge">
                        {Math.min(unreadMessages, 99)}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setScreen("activity")}
                    aria-label="Notifications"
                  >
                    <Icon name="bellModern" size={20} />
                    {unreadActivity > 0 && <i className="explore-head-dot" />}
                  </button>
                </div>
              </div>

              <PageTitle
                eyebrow="AVENZO DISCOVER"
                title="Discover"
                text="People, moments, clips and communities across AVENZO."
              />

              <label className="explore-search-box">
                <Icon name="search" size={19} />
                <input
                  ref={exploreSearchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value.slice(0, 120))}
                  placeholder="Search users, posts, reels or tags..."
                  aria-label="Search users, posts, reels or tags"
                  autoComplete="off"
                  inputMode="search"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                  >
                    <Icon name="close" size={16} />
                  </button>
                )}
              </label>

              <div
                className="avenzo-mobile-explore-filters"
                style={{ display: "none" }}
                role="tablist"
                aria-label="Explore filters"
              >
                {([
                  ["all", "grid", "All"],
                  ["reels", "reels", "Reels"],
                  ["photos", "camera", "Photos"],
                  ["art", "palette", "Art"],
                  ["travel", "plane", "Travel"],
                  ["gaming", "gamepad", "Gaming"],
                ] as const).map(([id, icon, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={exploreFilter === id ? "active" : ""}
                    onClick={() => setExploreFilter(id)}
                    role="tab"
                    aria-selected={exploreFilter === id}
                  >
                    <Icon name={icon} size={15} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {query && !exploreLoading && !exploreError && (
                <div className="search-summary">
                  {searchResultCount} results for <strong>&quot;{query}&quot;</strong>
                  <button type="button" onClick={() => setQuery("")}>Clear</button>
                </div>
              )}

              {exploreLoading ? (
                <div className="explore-loading" aria-label="Loading Explore">
                  <div className="explore-user-skeletons">
                    {Array.from({ length: 4 }, (_, index) => (
                      <span key={index} />
                    ))}
                  </div>
                  <div className="explore-grid-skeleton">
                    {Array.from({ length: 12 }, (_, index) => (
                      <span key={index} />
                    ))}
                  </div>
                </div>
              ) : exploreError ? (
                <div className="explore-error" role="alert">
                  <strong>Explore could not load.</strong>
                  <span>{exploreError}</span>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => void loadExploreData()}
                  >
                    Retry
                  </button>
                </div>
              ) : query && searchResultCount === 0 ? (
                <div className="explore-no-results">
                  <Icon name="search" size={28} />
                  <strong>No results for &quot;{query}&quot;</strong>
                  <span>Try a username, display name, caption, hashtag or reel title.</span>
                </div>
              ) : (
                <>
                  <section
                    className={
                      "explore-section explore-people-section" +
                      (!normalizedQuery ? " explore-people-idle" : "")
                    }
                  >
                    <div className="section-inline-head">
                      <div>
                        <div className="eyebrow">PEOPLE</div>
                        <h3>{query ? "Users" : "People to discover"}</h3>
                      </div>
                    </div>

                    {filteredPeople.length ? (
                      <div className="people-grid explore-people-grid">
                        {filteredPeople.map((person) => (
                          <PersonCard
                            key={person.id}
                            person={person}
                            following={followed.includes(person.id)}
                            requested={requested.includes(person.id)}
                            onFollow={() => void toggleFollow(person)}
                            onMessage={() =>
                              router.push(
                                "/messages?user=" + encodeURIComponent(person.username)
                              )
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="explore-inline-empty">
                        No matching users.
                      </div>
                    )}
                  </section>

                  <section className="explore-section explore-media-section">
                    <div className="section-inline-head">
                      <div>
                        <div className="eyebrow">MEDIA</div>
                        <h3>{query ? "Posts & reels" : "Explore"}</h3>
                      </div>
                    </div>

                    {filteredExplorePosts.length || filteredReels.length ? (
                      <ExploreMediaGrid
                        posts={filteredExplorePosts}
                        reels={filteredReels}
                        mediaUrl={mediaUrl}
                      />
                    ) : (
                      <div className="explore-inline-empty">
                        No matching posts or reels.
                      </div>
                    )}
                  </section>
                </>
              )}
            </section>
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

          <div className="side-card avenzo-spaces-card">
            <div className="side-card-head">
              <div>
                <small>AVENZO SPACES</small>
                <b>Your social hub</b>
              </div>
            </div>
            <div className="avenzo-spaces-grid">
              <button type="button" onClick={() => router.push("/messages")}>
                <Icon name="chatRound" size={18} />
                <span><b>Direct</b><small>Private chats</small></span>
                {unreadMessages > 0 && <i>{Math.min(unreadMessages, 99)}</i>}
              </button>
              <button type="button" onClick={() => router.push("/messages/groups")}>
                <Icon name="messages" size={18} />
                <span><b>Groups</b><small>Shared rooms</small></span>
              </button>
              <button type="button" onClick={() => router.push("/channels")}>
                <Icon name="globe" size={18} />
                <span><b>Channels</b><small>Broadcast spaces</small></span>
              </button>
              <button type="button" onClick={() => router.push("/settings/close-friends")}>
                <Icon name="heartModern" size={18} />
                <span><b>Circle</b><small>Close friends</small></span>
              </button>
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

      {!showCreate && !storyViewer && (
        <MobileBottomNav
          active={screen === "home" ? "home" : screen === "explore" ? "search" : screen === "profile" ? "profile" : null}
          onHome={() => selectPrimaryScreen("home")}
          onSearch={() => selectPrimaryScreen("explore")}
          onCreate={() => openComposer("post")}
          onReels={() => router.push("/reels")}
          onProfile={() => selectPrimaryScreen("profile")}
          profileAvatarUrl={avatarFor(profile)}
        />
      )}

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
          postFiles={postMedia.map((item) => item.file)}
          postPreviews={postMedia.map((item) => item.preview)}
          postDimensions={postMedia.map((item) => item.dimensions)}
          postAltTexts={postMedia.map((item) => item.altText)}
          coverFile={coverFile}
          coverPreview={coverPreview}
          dimensions={mediaDimensions}
          posting={posting}
          uploadProgress={uploadProgress}
          people={people}
          collaboratorIds={collaboratorIds}
          pollQuestion={pollQuestion}
          pollOptions={pollOptions}
          pollDurationHours={pollDurationHours}
          drafts={drafts}
          activeDraftId={activeDraftId}
          onSaveDraft={() => void saveCurrentDraft()}
          onRestoreDraft={(draft) => void restoreContentDraft(draft)}
          onDeleteDraft={(draftId) => void removeContentDraft(draftId)}
          onPollQuestionChange={setPollQuestion}
          onPollOptionsChange={setPollOptions}
          onPollDurationHoursChange={setPollDurationHours}
          onToggleCollaborator={(userId) =>
            setCollaboratorIds((current) =>
              current.includes(userId)
                ? current.filter((id) => id !== userId)
                : current.length < 3
                  ? [...current, userId]
                  : current
            )
          }
          onModeChange={(mode) => {
            resetComposer(mode);
            setActiveDraftId(null);
          }}
          onTitleChange={setTitle}
          onCaptionChange={setCaption}
          onHashtagsChange={setHashtags}
          onMentionsChange={setMentions}
          onLocationChange={setLocation}
          onPostAltTextChange={(index, value) =>
            setPostMedia((current) =>
              current.map((item, itemIndex) =>
                itemIndex === index ? { ...item, altText: value } : item
              )
            )
          }
          onReplacePostFile={(index, nextFile) =>
            void replacePostFile(index, nextFile)
          }
          onFileSelect={(nextFile) => void pickFile(nextFile)}
          onPostFilesSelect={(files) => void pickPostFiles(files)}
          onCoverSelect={pickCover}
          onClose={() => {
            resetComposer(createMode);
            setActiveDraftId(null);
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
