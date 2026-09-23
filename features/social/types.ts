export type Screen =
  | "home"
  | "explore"
  | "messages"
  | "activity"
  | "saved"
  | "profile"
  | "settings";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  created_at?: string;
};

export type Comment = {
  id: string;
  body: string;
  user_id: string;
  created_at: string;
  profile?: Profile;
};

export type Post = {
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

export type Reel = {
  id: string;
  author_id: string;
  caption: string;
  media_path: string;
  media_type: "video";
  created_at: string;
  profile?: Profile;
  likeCount: number;
  liked: boolean;
  commentCount: number;
  comments: Comment[];
};

export type Story = {
  id: string;
  author_id: string;
  media_path: string;
  media_type: "image" | "video";
  created_at: string;
  expires_at: string;
  profile?: Profile;
};

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at?: string | null;
};

export type Chat = {
  profile: Profile;
  last: string;
  updated: string;
  unread: number;
};

export type ProfileStats = {
  posts: number;
  followers: number;
  following: number;
};

export type NotificationRow = {
  id: string;
  type: "follow" | "like" | "comment" | "message";
  created_at: string;
  actor_id: string;
};
