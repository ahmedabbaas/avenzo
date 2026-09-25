export type Screen =
  | "home"
  | "explore"
  | "messages"
  | "activity"
  | "saved"
  | "profile";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  verified?: boolean;
  is_admin?: boolean;
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
  media_width?: number | null;
  media_height?: number | null;
  cover_path?: string | null;
  hashtags?: string[];
  mentions?: string[];
  location?: string;
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
  viewCount: number;
  shareCount: number;
  saveCount: number;
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
  media_width?: number | null;
  media_height?: number | null;
  caption?: string;
  hashtags?: string[];
  mentions?: string[];
  location?: string;
  cover_path?: string | null;
  created_at: string;
  expires_at: string;
  profile?: Profile;
  viewed?: boolean;
  viewerCount?: number;
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

export type FollowRelationshipState =
  | "none"
  | "requested"
  | "following"
  | "self";

export type NotificationRow = {
  id: string;
  type:
    | "follow"
    | "follow_request"
    | "follow_request_accepted"
    | "like"
    | "comment"
    | "message"
    | "message_request"
    | "message_reply"
    | "message_reaction";
  created_at: string;
  actor_id: string;
};
