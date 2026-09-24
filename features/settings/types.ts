export type ThemePreference = "light" | "dark" | "system";
export type AppLanguage = "en" | "ur";
export type AudiencePreference = "everyone" | "people_i_follow" | "no_one";
export type StoryVisibility = "everyone" | "followers" | "close_friends" | "only_me";

export type AppSettings = {
  user_id: string;
  theme: ThemePreference;
  language: AppLanguage;
  notify_likes: boolean;
  notify_comments: boolean;
  notify_followers: boolean;
  notify_messages: boolean;
  notify_mentions: boolean;
  notify_stories: boolean;
  notify_reels: boolean;
  notify_other: boolean;
  show_suggested_posts: boolean;
  feed_autoplay_videos: boolean;
  show_sensitive_content: boolean;
  data_saving_mode: boolean;
  media_autoplay_videos: boolean;
  high_quality_uploads: boolean;
  use_less_mobile_data: boolean;
  reduce_animations: boolean;
  larger_text: boolean;
  high_contrast: boolean;
  confirm_delete_content: boolean;
  confirm_unfollow: boolean;
  auto_save_settings: boolean;
};

export type PrivacySettings = {
  user_id: string;
  account_private: boolean;
  who_can_follow: AudiencePreference;
  who_can_message: AudiencePreference;
  who_can_send_message_requests: AudiencePreference;
  read_receipts: boolean;
  online_status: boolean;
  who_can_comment: AudiencePreference;
  who_can_mention: AudiencePreference;
  who_can_tag: AudiencePreference;
  story_visibility: StoryVisibility;
};
