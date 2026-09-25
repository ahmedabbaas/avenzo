export type BroadcastChannel = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  avatar_url: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  last_post_at: string | null;
  member_count: number;
  joined: boolean;
  role: "owner" | "moderator" | "member" | null;
};

export type BroadcastPost = {
  id: string;
  channel_id: string;
  author_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  author_name: string;
  author_username: string;
  author_avatar_url: string | null;
  author_verified: boolean;
  reactions: Array<{
    user_id: string;
    emoji: string;
  }>;
};
