export type GroupMember = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  verified: boolean;
  role: "owner" | "admin" | "member";
  joined_at: string;
};

export type GroupChat = {
  id: string;
  title: string;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  member_count: number;
  last_message: string;
  last_message_at_effective: string;
};

export type GroupMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  body: string;
  message_type: "text" | "image" | "video" | "file" | "audio";
  reply_to_id: string | null;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  sender?: GroupMember | null;
  reactions?: Array<{
    user_id: string;
    emoji: string;
  }>;
};
