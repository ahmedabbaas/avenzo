create index if not exists message_attachments_uploader_idx
  on public.message_attachments(uploader_id);

create index if not exists message_hidden_user_idx
  on public.message_hidden(user_id);

create index if not exists message_reactions_user_idx
  on public.message_reactions(user_id);

create index if not exists messages_reply_to_idx
  on public.messages(reply_to_id)
  where reply_to_id is not null;

create index if not exists messages_shared_post_idx
  on public.messages(shared_post_id)
  where shared_post_id is not null;

create index if not exists messages_shared_reel_idx
  on public.messages(shared_reel_id)
  where shared_reel_id is not null;

create index if not exists messages_shared_profile_idx
  on public.messages(shared_profile_id)
  where shared_profile_id is not null;
