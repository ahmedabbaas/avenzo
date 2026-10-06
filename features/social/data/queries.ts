import type { SupabaseClient } from "@supabase/supabase-js";
import { countBy, groupBy } from "../../../lib/collections";
import { DISCOVERY_PAGE_SIZE, discoveryTextFilter, type DiscoverySearchPage } from "../lib/discovery-search";
import type {
  Chat,
  Message,
  Post,
  PostMediaItem,
  Profile,
  ProfileStats,
  Reel,
  Story,
} from "../types";

const PROFILE_COLUMNS =
  "id,username,display_name,bio,avatar_url,website,verified,created_at";

const ACTIVITY_NOTIFICATION_TYPES = [
  "like",
  "comment",
  "reply",
  "comment_like",
  "follow",
  "follow_request",
  "follow_request_accepted",
];

type PostRow = {
  id: string;
  author_id: string;
  caption: string;
  media_path: string | null;
  media_type: "image" | "video" | null;
  media_width?: number | null;
  media_height?: number | null;
  cover_path?: string | null;
  hashtags?: string[];
  mentions?: string[];
  location?: string;
  created_at: string;
  pinned_at?: string | null;
};

type ReelRow = {
  id: string;
  author_id: string;
  title: string;
  caption: string;
  media_path: string;
  media_type: "video";
  cover_path: string | null;
  media_width?: number | null;
  media_height?: number | null;
  hashtags: string[];
  mentions: string[];
  location: string;
  view_count: number | string;
  share_count: number | string;
  save_count: number | string;
  created_at: string;
};

type StoryRow = {
  id: string;
  author_id: string;
  media_path: string;
  media_type: "image" | "video";
  media_width?: number | null;
  media_height?: number | null;
  caption?: string;
  hashtags?: string[];
  mentions?: string[];
  location?: string;
  cover_path?: string | null;
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
    .select(PROFILE_COLUMNS + ",is_admin")
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
    .in("type", ACTIVITY_NOTIFICATION_TYPES)
    .is("read_at", null);

  assertNoError(error);
  return count || 0;
}

export async function fetchProfileStats(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileStats> {
  const [ownPosts, collabPosts, followersCount, followingCount] = await Promise.all([
    supabase
      .from("posts")
      .select("id")
      .eq("author_id", userId),
    supabase
      .from("post_collaborators")
      .select("post_id")
      .eq("user_id", userId)
      .eq("status", "accepted"),
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", userId),
    supabase
      .from("follows")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", userId),
  ]);

  assertNoError(ownPosts.error);
  assertNoError(collabPosts.error);
  assertNoError(followersCount.error);
  assertNoError(followingCount.error);

  const postIds = new Set([
    ...(ownPosts.data || []).map((row: { id: string }) => row.id),
    ...(collabPosts.data || []).map((row: { post_id: string }) => row.post_id),
  ]);

  return {
    posts: postIds.size,
    followers: followersCount.count || 0,
    following: followingCount.count || 0,
  };
}

export async function fetchFollowingState(
  supabase: SupabaseClient,
  userId: string
) {
  const [followResult, requestResult] = await Promise.all([
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId),
    supabase
      .from("follow_requests")
      .select("target_id")
      .eq("requester_id", userId)
      .eq("status", "pending"),
  ]);

  assertNoError(followResult.error);
  assertNoError(requestResult.error);

  return {
    followed: (followResult.data || []).map(
      (row: { following_id: string }) => row.following_id
    ),
    requested: (requestResult.data || []).map(
      (row: { target_id: string }) => row.target_id
    ),
  };
}

export async function fetchPeopleAndFollowing(
  supabase: SupabaseClient,
  userId: string,
  limit = 40
) {
  const [profilesResult, followResult, requestResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .neq("id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId),
    supabase
      .from("follow_requests")
      .select("target_id")
      .eq("requester_id", userId)
      .eq("status", "pending"),
  ]);

  assertNoError(profilesResult.error);
  assertNoError(followResult.error);
  assertNoError(requestResult.error);

  return {
    people: (profilesResult.data || []) as Profile[],
    followed: (followResult.data || []).map(
      (row: { following_id: string }) => row.following_id
    ),
    requested: (requestResult.data || []).map(
      (row: { target_id: string }) => row.target_id
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

  const [
    authorsResult,
    likesResult,
    commentsResult,
    repostsResult,
    mediaItemsResult,
    collaboratorsResult,
    pollsResult,
  ] = await Promise.all([
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
      .select("id,post_id,user_id,body,created_at,parent_id")
      .in("post_id", postIds)
      .order("created_at", { ascending: true }),
    supabase
      .from("reposts")
      .select("post_id,user_id")
      .eq("user_id", userId)
      .in("post_id", postIds),
    supabase
      .from("post_media_items")
      .select("id,post_id,media_path,media_type,media_width,media_height,alt_text,position")
      .in("post_id", postIds)
      .order("position", { ascending: true }),
    supabase
      .from("post_collaborators")
      .select("post_id,user_id,status")
      .in("post_id", postIds)
      .eq("status", "accepted"),
    supabase
      .from("post_polls")
      .select("id,post_id,question,multiple_choice,closes_at,created_at")
      .in("post_id", postIds),
  ]);

  assertNoError(authorsResult.error);
  assertNoError(likesResult.error);
  assertNoError(commentsResult.error);
  assertNoError(repostsResult.error);
  assertNoError(mediaItemsResult.error);
  assertNoError(collaboratorsResult.error);
  assertNoError(pollsResult.error);

  const authors = (authorsResult.data || []) as Profile[];
  const authorMap = new Map(authors.map((author) => [author.id, author]));

  const commentRows = (commentsResult.data || []) as Array<{
    id: string;
    post_id: string;
    user_id: string;
    body: string;
    created_at: string;
    parent_id: string | null;
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

  let commentLikes: Array<{ comment_id: string; user_id: string }> = [];
  if (commentRows.length) {
    const result = await supabase
      .from("comment_likes")
      .select("comment_id,user_id")
      .in("comment_id", commentRows.map((comment) => comment.id));

    assertNoError(result.error);
    commentLikes = (result.data || []) as Array<{
      comment_id: string;
      user_id: string;
    }>;
  }

  const likes = (likesResult.data || []) as Array<{
    post_id: string;
    user_id: string;
  }>;
  const repostedPostIds = new Set(
    (repostsResult.data || [])
      .map((row: { post_id: string | null }) => row.post_id)
      .filter((id): id is string => Boolean(id))
  );

  const mediaItems = (mediaItemsResult.data || []).map((item) => ({
    ...item,
    media_type: "image" as const,
    url: supabase.storage.from("media").getPublicUrl(item.media_path).data.publicUrl,
  })) as PostMediaItem[];

  const collaboratorRows = (collaboratorsResult.data || []) as Array<{
    post_id: string;
    user_id: string;
    status: string;
  }>;
  const collaboratorUserIds = [
    ...new Set(collaboratorRows.map((row) => row.user_id)),
  ];
  let collaboratorProfiles: Profile[] = [];
  if (collaboratorUserIds.length) {
    const result = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .in("id", collaboratorUserIds);
    assertNoError(result.error);
    collaboratorProfiles = (result.data || []) as Profile[];
  }
  const collaboratorProfileMap = new Map(
    collaboratorProfiles.map((profile) => [profile.id, profile])
  );

  const pollRows = (pollsResult.data || []) as Array<{
    id: string;
    post_id: string;
    question: string;
    multiple_choice: boolean;
    closes_at: string | null;
  }>;
  const pollIds = pollRows.map((poll) => poll.id);

  let pollOptions: Array<{
    id: string;
    poll_id: string;
    label: string;
    position: number;
  }> = [];
  let pollVotes: Array<{
    poll_id: string;
    option_id: string;
    user_id: string;
  }> = [];

  if (pollIds.length) {
    const [optionsResult, votesResult] = await Promise.all([
      supabase
        .from("post_poll_options")
        .select("id,poll_id,label,position")
        .in("poll_id", pollIds)
        .order("position", { ascending: true }),
      supabase
        .from("post_poll_votes")
        .select("poll_id,option_id,user_id")
        .in("poll_id", pollIds),
    ]);
    assertNoError(optionsResult.error);
    assertNoError(votesResult.error);
    pollOptions = (optionsResult.data || []) as typeof pollOptions;
    pollVotes = (votesResult.data || []) as typeof pollVotes;
  }

  const pollByPost = new Map(pollRows.map((poll) => [poll.post_id, poll]));
  const pollOptionsByPoll = groupBy(pollOptions, (option) => option.poll_id);
  const pollVotesByPoll = groupBy(pollVotes, (vote) => vote.poll_id);

  const likesByPost = groupBy(likes, (like) => like.post_id);
  const commentsByPost = groupBy(commentRows, (comment) => comment.post_id);
  const commentLikesByComment = groupBy(
    commentLikes,
    (like) => like.comment_id
  );
  const mediaItemsByPost = groupBy(
    mediaItems,
    (item) => item.post_id
  );
  const collaboratorsByPost = groupBy(
    collaboratorRows,
    (row) => row.post_id
  );

  return rows.map((post) => {
    const postLikes = likesByPost.get(post.id) || [];
    const postComments = commentsByPost.get(post.id) || [];

    return {
      ...post,
      profile: authorMap.get(post.author_id),
      likeCount: postLikes.length,
      liked: postLikes.some((like) => like.user_id === userId),
      commentCount: postComments.length,
      comments: postComments.map((comment) => {
        const likesForComment =
          commentLikesByComment.get(comment.id) || [];

        return {
          id: comment.id,
          body: comment.body,
          user_id: comment.user_id,
          created_at: comment.created_at,
          parent_id: comment.parent_id,
          likeCount: likesForComment.length,
          liked: likesForComment.some(
            (like) => like.user_id === userId
          ),
          profile: commentUserMap.get(comment.user_id),
        };
      }),
      reposted: repostedPostIds.has(post.id),
      mediaItems: mediaItemsByPost.get(post.id) || [],
      collaborators: (collaboratorsByPost.get(post.id) || [])
        .map((row) => collaboratorProfileMap.get(row.user_id))
        .filter((profile): profile is Profile => Boolean(profile)),
      poll: (() => {
        const poll = pollByPost.get(post.id);
        if (!poll) return undefined;
        const options = pollOptionsByPoll.get(poll.id) || [];
        const votes = pollVotesByPoll.get(poll.id) || [];
        const voteCounts = new Map<string, number>();
        for (const vote of votes) {
          voteCounts.set(vote.option_id, (voteCounts.get(vote.option_id) || 0) + 1);
        }
        return {
          ...poll,
          totalVotes: votes.length,
          selectedOptionId:
            votes.find((vote) => vote.user_id === userId)?.option_id || null,
          options: options.map((option) => ({
            id: option.id,
            label: option.label,
            position: option.position,
            voteCount: voteCounts.get(option.id) || 0,
          })),
        };
      })(),
    };
  });
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

  const [authoredResult, collabResult] = await Promise.all([
    supabase
      .from("posts")
      .select("*")
      .in("author_id", feedAuthors)
      .order("created_at", { ascending: false })
      .limit(36),
    supabase
      .from("post_collaborators")
      .select("post_id")
      .in("user_id", feedAuthors)
      .eq("status", "accepted"),
  ]);

  assertNoError(authoredResult.error);
  assertNoError(collabResult.error);

  const collabPostIds = (collabResult.data || []).map(
    (row: { post_id: string }) => row.post_id
  );

  let collabPosts: PostRow[] = [];
  if (collabPostIds.length) {
    const result = await supabase
      .from("posts")
      .select("*")
      .in("id", collabPostIds);
    assertNoError(result.error);
    collabPosts = (result.data || []) as PostRow[];
  }

  const postMap = new Map<string, PostRow>();
  for (const row of [
    ...((authoredResult.data || []) as PostRow[]),
    ...collabPosts,
  ]) {
    postMap.set(row.id, row);
  }

  const rows = [...postMap.values()]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    )
    .slice(0, 36);

  return hydratePosts(supabase, userId, rows);
}

export async function fetchProfilePosts(
  supabase: SupabaseClient,
  userId: string
) {
  const [ownResult, collabResult] = await Promise.all([
    supabase
      .from("posts")
      .select("*")
      .eq("author_id", userId)
      .order("created_at", { ascending: false })
      .limit(72),
    supabase
      .from("post_collaborators")
      .select("post_id")
      .eq("user_id", userId)
      .eq("status", "accepted"),
  ]);

  assertNoError(ownResult.error);
  assertNoError(collabResult.error);

  const collabIds = (collabResult.data || []).map(
    (row: { post_id: string }) => row.post_id
  );

  let collabPosts: PostRow[] = [];
  if (collabIds.length) {
    const result = await supabase
      .from("posts")
      .select("*")
      .in("id", collabIds);
    assertNoError(result.error);
    collabPosts = (result.data || []) as PostRow[];
  }

  const map = new Map<string, PostRow>();
  for (const row of [
    ...((ownResult.data || []) as PostRow[]),
    ...collabPosts,
  ]) {
    map.set(row.id, row);
  }

  const rows = [...map.values()]
    .sort((a, b) => {
      const aPinned = a.pinned_at ? new Date(a.pinned_at).getTime() : 0;
      const bPinned = b.pinned_at ? new Date(b.pinned_at).getTime() : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );
    })
    .slice(0, 72);

  return hydratePosts(supabase, userId, rows);
}

export async function fetchProfilePostsForViewer(
  supabase: SupabaseClient,
  viewerId: string,
  profileId: string,
  limit = 60
) {
  const [ownResult, collabResult] = await Promise.all([
    supabase
      .from("posts")
      .select("*")
      .eq("author_id", profileId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("post_collaborators")
      .select("post_id")
      .eq("user_id", profileId)
      .eq("status", "accepted"),
  ]);

  assertNoError(ownResult.error);
  assertNoError(collabResult.error);

  const collabIds = (collabResult.data || []).map(
    (row: { post_id: string }) => row.post_id
  );

  let collabPosts: PostRow[] = [];
  if (collabIds.length) {
    const result = await supabase
      .from("posts")
      .select("*")
      .in("id", collabIds);
    assertNoError(result.error);
    collabPosts = (result.data || []) as PostRow[];
  }

  const map = new Map<string, PostRow>();
  for (const row of [
    ...((ownResult.data || []) as PostRow[]),
    ...collabPosts,
  ]) {
    map.set(row.id, row);
  }

  const rows = [...map.values()]
    .sort((a, b) => {
      const aPinned = a.pinned_at ? new Date(a.pinned_at).getTime() : 0;
      const bPinned = b.pinned_at ? new Date(b.pinned_at).getTime() : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );
    })
    .slice(0, limit);

  return hydratePosts(supabase, viewerId, rows);
}

export async function fetchAuthorPosts(
  supabase: SupabaseClient,
  viewerId: string,
  authorId: string,
  limit = 60
) {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  assertNoError(error);
  return hydratePosts(supabase, viewerId, (data || []) as PostRow[]);
}

export async function fetchPostById(
  supabase: SupabaseClient,
  userId: string,
  postId: string
): Promise<Post | null> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();

  assertNoError(error);

  if (!data) return null;

  const posts = await hydratePosts(
    supabase,
    userId,
    [data as PostRow]
  );

  return posts[0] || null;
}

export async function fetchExplorePosts(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(36);

  assertNoError(error);
  return hydratePosts(supabase, userId, (data || []) as PostRow[]);
}

export async function fetchReels(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    authorId?: string;
    limit?: number;
    ids?: string[];
  }
): Promise<{ reels: Reel[]; savedReels: string[] }> {
  let query = supabase
    .from("reels")
    .select("*");

  if (options?.authorId) {
    query = query.eq("author_id", options.authorId);
  }

  if (options?.ids) {
    query = query.in("id", options.ids);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(options?.limit || 32);

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

  const [authorsResult, likesResult, commentsResult, savedResult, repostsResult] =
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
      supabase
        .from("reposts")
        .select("reel_id,user_id")
        .eq("user_id", userId)
        .in("reel_id", reelIds),
    ]);

  assertNoError(authorsResult.error);
  assertNoError(likesResult.error);
  assertNoError(commentsResult.error);
  assertNoError(savedResult.error);
  assertNoError(repostsResult.error);

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
  const repostedReelIds = new Set(
    (repostsResult.data || [])
      .map((row: { reel_id: string | null }) => row.reel_id)
      .filter((id): id is string => Boolean(id))
  );

  const likesByReel = groupBy(likes, (like) => like.reel_id);
  const commentsByReel = groupBy(
    comments,
    (comment) => comment.reel_id
  );

  return {
    reels: rows.map((reel) => {
      const reelLikes = likesByReel.get(reel.id) || [];
      const reelComments = commentsByReel.get(reel.id) || [];

      return {
        ...reel,
        title: reel.title || "",
        hashtags: reel.hashtags || [],
        mentions: reel.mentions || [],
        location: reel.location || "",
        viewCount: Number(reel.view_count || 0),
        shareCount: Number(reel.share_count || 0),
        saveCount: Number(reel.save_count || 0),
        profile: authorMap.get(reel.author_id),
        likeCount: reelLikes.length,
        liked: reelLikes.some((like) => like.user_id === userId),
        commentCount: reelComments.length,
        comments: reelComments.map((comment) => ({
          id: comment.id,
          body: comment.body,
          user_id: comment.user_id,
          created_at: comment.created_at,
          profile: commentUserMap.get(comment.user_id),
        })),
        reposted: repostedReelIds.has(reel.id),
      };
    }),
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const storyIds = rows.map((story) => story.id);
  const viewResult = user && storyIds.length
    ? await supabase
        .from("story_views")
        .select("story_id,viewer_id")
        .in("story_id", storyIds)
    : { data: [], error: null };

  assertNoError(viewResult.error);

  const views = (viewResult.data || []) as Array<{
    story_id: string;
    viewer_id: string;
  }>;

  const viewsByStory = groupBy(
    views,
    (view) => view.story_id
  );

  return rows.map((story) => {
    const storyViews = viewsByStory.get(story.id) || [];

    return {
      ...story,
      profile: authorMap.get(story.author_id),
      viewed:
        story.author_id === user?.id ||
        storyViews.some((view) => view.viewer_id === user?.id),
      viewerCount:
        story.author_id === user?.id
          ? storyViews.length
          : undefined,
    };
  });
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

  const unreadBySender = countBy(
    rows.filter(
      (message) =>
        message.recipient_id === userId &&
        !message.read_at
    ),
    (message) => message.sender_id
  );

  const chats: Chat[] = [];

  for (const [otherId, latestMessage] of latest.entries()) {
    const profile = profileMap.get(otherId);
    if (!profile) continue;

    chats.push({
      profile,
      last: latestMessage.body,
      updated: latestMessage.created_at,
      unread: unreadBySender.get(otherId) || 0,
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

export async function searchDiscovery(
  supabase: SupabaseClient, userId: string, term: string, page: number
): Promise<DiscoverySearchPage> {
  const start = page * DISCOVERY_PAGE_SIZE;
  const profileFilter = discoveryTextFilter(["username", "display_name"], term);
  const [peopleResult, authorsResult] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).or(profileFilter).neq("id", userId)
      .order("created_at", { ascending:false }).order("id", { ascending:false })
      .range(start, start + DISCOVERY_PAGE_SIZE),
    supabase.from("profiles").select("id").or(profileFilter).limit(80),
  ]);
  assertNoError(peopleResult.error); assertNoError(authorsResult.error);
  const authorIds = (authorsResult.data || []).map(row => String(row.id))
    .filter(id => /^[0-9a-f-]{36}$/i.test(id));
  const tag = term.toLowerCase().replace(/\s/g, "");
  const extras = [`hashtags.cs.{${tag}}`, `mentions.cs.{${tag}}`];
  if (authorIds.length) extras.push("author_id.in.(" + authorIds.join(",") + ")");
  const [postsResult, reelsResult] = await Promise.all([
    supabase.from("posts").select("*")
      .or([discoveryTextFilter(["caption", "location"], term), ...extras].join(","))
      .order("created_at", { ascending:false }).order("id", { ascending:false })
      .range(start, start + DISCOVERY_PAGE_SIZE),
    supabase.from("reels").select("id")
      .or([discoveryTextFilter(["title", "caption", "location"], term), ...extras].join(","))
      .order("created_at", { ascending:false }).order("id", { ascending:false })
      .range(start, start + DISCOVERY_PAGE_SIZE),
  ]);
  assertNoError(postsResult.error); assertNoError(reelsResult.error);
  const rawPeople = peopleResult.data || [];
  const rawPosts = postsResult.data || [];
  const rawReels = reelsResult.data || [];
  const reelIds = rawReels.slice(0, DISCOVERY_PAGE_SIZE).map(row => String(row.id));
  const [posts, reels] = await Promise.all([
    hydratePosts(supabase, userId, rawPosts.slice(0, DISCOVERY_PAGE_SIZE) as PostRow[]),
    reelIds.length ? fetchReels(supabase, userId, { ids:reelIds, limit:DISCOVERY_PAGE_SIZE }) : Promise.resolve({ reels:[] as Reel[], savedReels:[] as string[] }),
  ]);
  return { people:rawPeople.slice(0, DISCOVERY_PAGE_SIZE) as Profile[], posts, reels:reels.reels, page,
    hasMore:page < 99 && [rawPeople, rawPosts, rawReels].some(rows => rows.length > DISCOVERY_PAGE_SIZE) };
}
