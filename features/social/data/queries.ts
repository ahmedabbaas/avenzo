import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Chat,
  Message,
  Post,
  Profile,
  ProfileStats,
  Reel,
  Story,
} from "../types";

const PROFILE_COLUMNS =
  "id,username,display_name,bio,avatar_url,created_at";

type PostRow = {
  id: string;
  author_id: string;
  caption: string;
  media_path: string | null;
  media_type: "image" | "video" | null;
  media_width?: number | null;
  media_height?: number | null;
  created_at: string;
};

type ReelRow = {
  id: string;
  author_id: string;
  caption: string;
  media_path: string;
  media_type: "video";
  created_at: string;
};

type StoryRow = {
  id: string;
  author_id: string;
  media_path: string;
  media_type: "image" | "video";
  media_width?: number | null;
  media_height?: number | null;
  created_at: string;
  expires_at: string;
};

function assertNoError(error: unknown) {
  if (error) throw error;
}

export async function fetchProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .single();

  assertNoError(error);
  return (data as Profile | null) || null;
}

export async function fetchUnreadActivityCount(
  supabase: SupabaseClient,
  userId: string
) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .is("read_at", null);

  assertNoError(error);
  return count || 0;
}

export async function fetchProfileStats(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileStats> {
  const [postsCount, followersCount, followingCount] = await Promise.all([
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId),
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", userId),
    supabase
      .from("follows")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", userId),
  ]);

  assertNoError(postsCount.error);
  assertNoError(followersCount.error);
  assertNoError(followingCount.error);

  return {
    posts: postsCount.count || 0,
    followers: followersCount.count || 0,
    following: followingCount.count || 0,
  };
}

export async function fetchPeopleAndFollowing(
  supabase: SupabaseClient,
  userId: string
) {
  const [profilesResult, followResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .neq("id", userId)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId),
  ]);

  assertNoError(profilesResult.error);
  assertNoError(followResult.error);

  return {
    people: (profilesResult.data || []) as Profile[],
    followed: (followResult.data || []).map(
      (row: { following_id: string }) => row.following_id
    ),
  };
}

async function hydratePosts(
  supabase: SupabaseClient,
  userId: string,
  rows: PostRow[]
): Promise<Post[]> {
  if (rows.length === 0) return [];

  const authorIds = [...new Set(rows.map((post) => post.author_id))];
  const postIds = rows.map((post) => post.id);

  const [authorsResult, likesResult, commentsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .in("id", authorIds),
    supabase
      .from("likes")
      .select("post_id,user_id")
      .in("post_id", postIds),
    supabase
      .from("comments")
      .select("id,post_id,user_id,body,created_at")
      .in("post_id", postIds)
      .order("created_at", { ascending: true }),
  ]);

  assertNoError(authorsResult.error);
  assertNoError(likesResult.error);
  assertNoError(commentsResult.error);

  const authors = (authorsResult.data || []) as Profile[];
  const authorMap = new Map(authors.map((author) => [author.id, author]));

  const commentRows = (commentsResult.data || []) as Array<{
    id: string;
    post_id: string;
    user_id: string;
    body: string;
    created_at: string;
  }>;

  const commentUserIds = [
    ...new Set(commentRows.map((comment) => comment.user_id)),
  ];

  let commentUsers: Profile[] = [];
  if (commentUserIds.length) {
    const result = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .in("id", commentUserIds);

    assertNoError(result.error);
    commentUsers = (result.data || []) as Profile[];
  }

  const commentUserMap = new Map(
    commentUsers.map((profile) => [profile.id, profile])
  );

  const likes = (likesResult.data || []) as Array<{
    post_id: string;
    user_id: string;
  }>;

  return rows.map((post) => ({
    ...post,
    profile: authorMap.get(post.author_id),
    likeCount: likes.filter((like) => like.post_id === post.id).length,
    liked: likes.some(
      (like) => like.post_id === post.id && like.user_id === userId
    ),
    commentCount: commentRows.filter(
      (comment) => comment.post_id === post.id
    ).length,
    comments: commentRows
      .filter((comment) => comment.post_id === post.id)
      .map((comment) => ({
        id: comment.id,
        body: comment.body,
        user_id: comment.user_id,
        created_at: comment.created_at,
        profile: commentUserMap.get(comment.user_id),
      })),
  }));
}

export async function fetchSavedPostIds(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("saved_posts")
    .select("post_id")
    .eq("user_id", userId);

  assertNoError(error);
  return (data || []).map((row: { post_id: string }) => row.post_id);
}

export async function fetchFeedPosts(
  supabase: SupabaseClient,
  userId: string
) {
  const { data: followRows, error: followError } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  assertNoError(followError);

  const feedAuthors = [
    userId,
    ...(followRows || []).map(
      (row: { following_id: string }) => row.following_id
    ),
  ];

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .in("author_id", feedAuthors)
    .order("created_at", { ascending: false })
    .limit(60);

  assertNoError(error);
  return hydratePosts(supabase, userId, (data || []) as PostRow[]);
}

export async function fetchExplorePosts(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(60);

  assertNoError(error);
  return hydratePosts(supabase, userId, (data || []) as PostRow[]);
}

export async function fetchReels(
  supabase: SupabaseClient,
  userId: string
): Promise<{ reels: Reel[]; savedReels: string[] }> {
  const { data, error } = await supabase
    .from("reels")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(60);

  assertNoError(error);

  const rows = (data || []) as ReelRow[];
  if (rows.length === 0) {
    const savedResult = await supabase
      .from("saved_reels")
      .select("reel_id")
      .eq("user_id", userId);

    assertNoError(savedResult.error);

    return {
      reels: [],
      savedReels: (savedResult.data || []).map(
        (row: { reel_id: string }) => row.reel_id
      ),
    };
  }

  const reelIds = rows.map((reel) => reel.id);
  const authorIds = [...new Set(rows.map((reel) => reel.author_id))];

  const [authorsResult, likesResult, commentsResult, savedResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .in("id", authorIds),
      supabase
        .from("reel_likes")
        .select("reel_id,user_id")
        .in("reel_id", reelIds),
      supabase
        .from("reel_comments")
        .select("id,reel_id,user_id,body,created_at")
        .in("reel_id", reelIds)
        .order("created_at", { ascending: true }),
      supabase
        .from("saved_reels")
        .select("reel_id")
        .eq("user_id", userId),
    ]);

  assertNoError(authorsResult.error);
  assertNoError(likesResult.error);
  assertNoError(commentsResult.error);
  assertNoError(savedResult.error);

  const authors = (authorsResult.data || []) as Profile[];
  const authorMap = new Map(authors.map((author) => [author.id, author]));

  const comments = (commentsResult.data || []) as Array<{
    id: string;
    reel_id: string;
    user_id: string;
    body: string;
    created_at: string;
  }>;

  const commentUserIds = [
    ...new Set(comments.map((comment) => comment.user_id)),
  ];

  let commentUsers: Profile[] = [];
  if (commentUserIds.length) {
    const result = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .in("id", commentUserIds);

    assertNoError(result.error);
    commentUsers = (result.data || []) as Profile[];
  }

  const commentUserMap = new Map(
    commentUsers.map((profile) => [profile.id, profile])
  );

  const likes = (likesResult.data || []) as Array<{
    reel_id: string;
    user_id: string;
  }>;

  return {
    reels: rows.map((reel) => ({
      ...reel,
      profile: authorMap.get(reel.author_id),
      likeCount: likes.filter((like) => like.reel_id === reel.id).length,
      liked: likes.some(
        (like) => like.reel_id === reel.id && like.user_id === userId
      ),
      commentCount: comments.filter(
        (comment) => comment.reel_id === reel.id
      ).length,
      comments: comments
        .filter((comment) => comment.reel_id === reel.id)
        .map((comment) => ({
          id: comment.id,
          body: comment.body,
          user_id: comment.user_id,
          created_at: comment.created_at,
          profile: commentUserMap.get(comment.user_id),
        })),
    })),
    savedReels: (savedResult.data || []).map(
      (row: { reel_id: string }) => row.reel_id
    ),
  };
}

export async function fetchStories(
  supabase: SupabaseClient
): Promise<Story[]> {
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  assertNoError(error);

  const rows = (data || []) as StoryRow[];
  if (!rows.length) return [];

  const authorIds = [...new Set(rows.map((story) => story.author_id))];
  const authorsResult = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .in("id", authorIds);

  assertNoError(authorsResult.error);

  const authors = (authorsResult.data || []) as Profile[];
  const authorMap = new Map(authors.map((author) => [author.id, author]));

  return rows.map((story) => ({
    ...story,
    profile: authorMap.get(story.author_id),
  }));
}

export async function fetchChats(
  supabase: SupabaseClient,
  userId: string
): Promise<Chat[]> {
  const filter = `sender_id.eq.${userId},recipient_id.eq.${userId}`;

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(filter)
    .order("created_at", { ascending: false })
    .limit(300);

  assertNoError(error);

  const rows = (data || []) as Message[];
  const otherIds = [
    ...new Set(
      rows.map((message) =>
        message.sender_id === userId
          ? message.recipient_id
          : message.sender_id
      )
    ),
  ];

  let profiles: Profile[] = [];
  if (otherIds.length) {
    const result = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .in("id", otherIds);

    assertNoError(result.error);
    profiles = (result.data || []) as Profile[];
  }

  const profileMap = new Map(
    profiles.map((profile) => [profile.id, profile])
  );

  const latest = new Map<string, Message>();
  for (const message of rows) {
    const otherId =
      message.sender_id === userId
        ? message.recipient_id
        : message.sender_id;

    if (!latest.has(otherId)) {
      latest.set(otherId, message);
    }
  }

  const chats: Chat[] = [];

  for (const [otherId, latestMessage] of latest.entries()) {
    const profile = profileMap.get(otherId);
    if (!profile) continue;

    chats.push({
      profile,
      last: latestMessage.body,
      updated: latestMessage.created_at,
      unread: rows.filter(
        (message) =>
          message.sender_id === otherId &&
          message.recipient_id === userId &&
          !message.read_at
      ).length,
    });
  }

  return chats;
}

export async function fetchConversation(
  supabase: SupabaseClient,
  userId: string,
  otherUserId: string
): Promise<Message[]> {
  const filter =
    `and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),` +
    `and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`;

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(filter)
    .order("created_at", { ascending: true });

  assertNoError(error);
  return (data || []) as Message[];
}

export async function markConversationRead(
  supabase: SupabaseClient,
  userId: string,
  otherUserId: string
) {
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("sender_id", otherUserId)
    .eq("recipient_id", userId)
    .is("read_at", null);

  assertNoError(error);
}
