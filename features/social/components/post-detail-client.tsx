"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import PostCard from "./post-card";
import Icon from "./icon";
import { useRuntimePreferences } from "../../settings/lib/runtime-preferences";
import type {
  Comment,
  Post,
  Profile,
} from "../types";
import {
  fetchPostById,
  fetchProfilePostsForViewer,
  fetchSavedPostIds,
} from "../data/queries";
import {
  createPostComment,
  removePost,
  removePostComment,
  reportPost,
  setPostCommentLike,
  setPostLike,
  setPostReposted,
  setPostSaved,
  setPostPollVote,
  updatePostCaption,
} from "../data/mutations";

export default function PostDetailClient({
  currentUserId,
  profile,
  initialPosts,
  initialSaved,
  initialPostId,
  detailOnly = false,
}: {
  currentUserId: string;
  profile: Profile;
  initialPosts: Post[];
  initialSaved: string[];
  initialPostId: string;
  detailOnly?: boolean;
}) {
  const router = useRouter();
  const preferences = useRuntimePreferences();
  const supabase = useMemo(() => createClient(), []);
  const [posts, setPosts] = useState(initialPosts);
  const [saved, setSaved] = useState(initialSaved);
  const [notice, setNotice] = useState("");
  const pendingActions = useRef(new Set<string>());

  const mediaUrl = useCallback(
    (path: string) =>
      supabase.storage.from("media").getPublicUrl(path).data.publicUrl,
    [supabase]
  );

  const refresh = useCallback(async () => {
    const [nextPosts, nextSaved] = await Promise.all([
      detailOnly
        ? fetchPostById(supabase, currentUserId, initialPostId).then(post => post ? [post] : [])
        : fetchProfilePostsForViewer(supabase, currentUserId, profile.id, 60),
      fetchSavedPostIds(supabase, currentUserId),
    ]);
    setPosts(nextPosts);
    setSaved(nextSaved);
  }, [currentUserId, profile.id, supabase, detailOnly, initialPostId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById("avenzo-mobile-post-" + initialPostId)
        ?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialPostId]);

  function goBack() {
    if (window.history.length > 1) router.back();
    else if (profile.id === currentUserId) router.push("/home?screen=profile");
    else router.push("/u/" + encodeURIComponent(profile.username));
  }

  async function toggleLike(post: Post) {
    const actionKey = "like:" + post.id;
    if (pendingActions.current.has(actionKey)) return;
    pendingActions.current.add(actionKey);
    const nextLiked = !post.liked;
    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? {
              ...item,
              liked: nextLiked,
              likeCount: Math.max(
                0,
                item.likeCount + (nextLiked ? 1 : -1)
              ),
            }
          : item
      )
    );

    try {
      await setPostLike(supabase, currentUserId, post.id, post.liked);
    } catch {
      setNotice("This action could not be saved. Try again.");
      try { await refresh(); } catch { setNotice("Could not reload the post. Check your connection."); }
    } finally {
      pendingActions.current.delete(actionKey);
    }
  }

  async function toggleSave(post: Post) {
    const actionKey = "save:" + post.id;
    if (pendingActions.current.has(actionKey)) return;
    pendingActions.current.add(actionKey);
    const isSaved = saved.includes(post.id);
    setSaved((current) =>
      isSaved
        ? current.filter((id) => id !== post.id)
        : [...current, post.id]
    );

    try {
      await setPostSaved(supabase, currentUserId, post.id, isSaved);
    } catch {
      setSaved(current => isSaved ? [...current, post.id] : current.filter(id => id !== post.id));
      setNotice("Post could not be saved. Try again.");
    } finally {
      pendingActions.current.delete(actionKey);
    }
  }

  async function toggleRepost(post: Post) {
    const actionKey = "repost:" + post.id;
    if (pendingActions.current.has(actionKey)) return;
    pendingActions.current.add(actionKey);
    const wasReposted = Boolean(post.reposted);
    setPosts((current) =>
      current.map((item) =>
        item.id === post.id ? { ...item, reposted: !wasReposted } : item
      )
    );

    try {
      await setPostReposted(
        supabase,
        currentUserId,
        post.id,
        wasReposted
      );
    } catch {
      setNotice("This action could not be saved. Try again.");
      try { await refresh(); } catch { setNotice("Could not reload the post. Check your connection."); }
    } finally {
      pendingActions.current.delete(actionKey);
    }
  }

  async function addComment(
    post: Post,
    body: string,
    parentId: string | null
  ) {
    try {
      await createPostComment(
        supabase,
        currentUserId,
        post.id,
        body,
        parentId
      );
      await refresh();
    } catch {
      setNotice("Comment could not be posted.");
    }
  }

  async function toggleCommentLike(post: Post, comment: Comment) {
    const nextLiked = !comment.liked;
    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? {
              ...item,
              comments: item.comments.map((entry) =>
                entry.id === comment.id
                  ? {
                      ...entry,
                      liked: nextLiked,
                      likeCount: Math.max(
                        0,
                        (entry.likeCount || 0) + (nextLiked ? 1 : -1)
                      ),
                    }
                  : entry
              ),
            }
          : item
      )
    );

    try {
      await setPostCommentLike(
        supabase,
        currentUserId,
        comment.id,
        Boolean(comment.liked)
      );
    } catch {
      setNotice("This action could not be saved. Try again.");
      try { await refresh(); } catch { setNotice("Could not reload the post. Check your connection."); }
    }
  }

  async function deleteComment(post: Post, comment: Comment) {
    if (!window.confirm("Delete this comment?")) return;

    try {
      await removePostComment(supabase, currentUserId, comment.id);
      await refresh();
    } catch {
      setNotice("Comment could not be deleted.");
    }
  }

  async function editCaption(post: Post, caption: string) {
    try {
      await updatePostCaption(
        supabase,
        currentUserId,
        post.id,
        caption
      );
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id ? { ...item, caption } : item
        )
      );
    } catch {
      setNotice("Caption could not be updated.");
    }
  }

  async function deletePost(post: Post) {
    if (preferences.confirm_delete_content && !window.confirm("Delete this post permanently?")) return;

    try {
      await removePost(supabase, currentUserId, post);
      setPosts((current) => current.filter((item) => item.id !== post.id));
      if (posts.length <= 1) goBack();
    } catch {
      setNotice("Post could not be deleted.");
    }
  }

  async function submitReport(post: Post) {
    try {
      await reportPost(supabase, currentUserId, post.id);
      setNotice("Post reported.");
    } catch {
      setNotice("Report could not be submitted.");
    }
  }

  return (
    <main className={"avenzo-mobile-profile-feed rich-post-viewer" + (detailOnly ? " single-post-viewer" : "")}>
      <header className="avenzo-mobile-profile-feed-head">
        <button type="button" onClick={goBack} aria-label="Back to profile">
          <Icon name="back" size={22} />
        </button>
        <span>
          <b>{detailOnly ? "Post" : "Posts"}</b>
          <small>@{profile.username}</small>
        </span>
        <i />
      </header>

      {notice && (
        <button
          type="button"
          className="avenzo-mobile-profile-feed-notice"
          onClick={() => setNotice("")}
        >
          {notice}
        </button>
      )}

      <section className="avenzo-mobile-profile-feed-scroll" aria-label="Profile posts">
        {posts.map((post) => (
          <div
            className="avenzo-mobile-post-slide"
            id={"avenzo-mobile-post-" + post.id}
            key={post.id}
          >
            <PostCard
              post={post}
              saved={saved.includes(post.id)}
              mediaUrl={post.media_path ? mediaUrl(post.media_path) : ""}
              onLike={() => void toggleLike(post)}
              onSave={() => void toggleSave(post)}
              onShare={() =>
                router.push(
                  "/messages?sharePost=" + encodeURIComponent(post.id)
                )
              }
              onRepost={() => void toggleRepost(post)}
              onPollVote={optionId => { void setPostPollVote(supabase, currentUserId, post.poll!.id, optionId, post.poll!.selectedOptionId || null).then(refresh).catch(() => setNotice("Vote could not be saved. Try again.")); }}
              onComment={(body, parentId) =>
                void addComment(post, body, parentId || null)
              }
              onCommentLike={(comment) =>
                void toggleCommentLike(post, comment)
              }
              onCommentDelete={(comment) =>
                void deleteComment(post, comment)
              }
              onEditCaption={(caption) =>
                void editCaption(post, caption)
              }
              onReport={() => void submitReport(post)}
              currentUserId={currentUserId}
              own={post.author_id === currentUserId}
              onDelete={() => void deletePost(post)}
              autoplayVideo={false}
              dataSaving={preferences.data_saving_mode || preferences.use_less_mobile_data}
            />
          </div>
        ))}
      </section>
    </main>
  );
}
