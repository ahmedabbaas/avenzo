import type { Profile } from "../social/types";

export type MessageType =
  | "text"
  | "image"
  | "video"
  | "file"
  | "audio"
  | "shared_post"
  | "shared_reel"
  | "shared_profile";

export type InboxConversation = {
  conversation_id: string;
  other_user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  verified: boolean;
  last_message: string;
  last_message_type: MessageType | null;
  last_message_at: string;
  unread_count: number;
  request_status: "pending" | "accepted" | "declined" | "deleted";
  request_incoming: boolean;
  muted: boolean;
  theme: "violet" | "ocean" | "emerald" | "sunset" | "mono";
  inbox_folder: "primary" | "general";
  pinned: boolean;
  pinned_at: string | null;
};

export type MessageAttachment = {
  id: string;
  message_id: string;
  uploader_id: string;
  kind: "image" | "video" | "file" | "audio";
  storage_path: string;
  mime_type: string;
  file_name: string;
  size_bytes: number;
  duration_seconds: number | null;
  created_at: string;
};

export type MessageReaction = {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  updated_at: string;
};

export type SharedPostPreview = {
  id: string;
  caption: string;
  media_path: string | null;
  media_type: "image" | "video" | null;
  creator_username: string;
  creator_name: string;
  creator_verified: boolean;
};

export type SharedReelPreview = {
  id: string;
  title?: string;
  caption: string;
  media_path: string;
  cover_path?: string | null;
  creator_username: string;
  creator_name: string;
  creator_verified: boolean;
};

export type SharedProfilePreview = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  verified: boolean;
};

export type DirectMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  message_type: MessageType;
  body: string;
  reply_to_id: string | null;
  shared_post_id: string | null;
  shared_reel_id: string | null;
  shared_profile_id: string | null;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  deleted_for_everyone_at: string | null;
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
  reply_to?: DirectMessage | null;
  shared_post?: SharedPostPreview | null;
  shared_reel?: SharedReelPreview | null;
  shared_profile?: SharedProfilePreview | null;
};

export type DirectConversation = {
  inbox: InboxConversation;
  profile: Profile;
};


export type MessageNote = {
  user_id: string;
  body: string;
  audience: "everyone" | "followers" | "close_friends";
  created_at: string;
  updated_at: string;
  expires_at: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  verified: boolean;
};


export type PinnedMessage = {
  message_id: string;
  sender_id: string;
  message_type: MessageType;
  body: string;
  created_at: string;
  pinned_at: string;
  pinned_by: string;
};
