-- AVENZO production schema
-- Safe foundation for Auth, unique usernames, posts, follows, comments,
-- saves, direct messages, notifications, storage and realtime.

create extension if not exists pgcrypto;

-- Permanent username reservation. Intentionally no FK to auth.users:
-- deleting an account does not make its old username reusable.
create table if not exists public.username_claims (
  username text primary key,
  claimed_by uuid not null,
  claimed_at timestamptz not null default now(),
  constraint username_claim_format
    check (username ~ '^[a-z0-9._]{3,30}$')
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique references public.username_claims(username),
  display_name text not null
    check (char_length(trim(display_name)) between 1 and 80),
  bio text not null default ''
    check (char_length(bio) <= 160),
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete cascade,
  reported_post_id uuid,
  reason text not null
    check (reason in ('spam','harassment','hate','impersonation','sexual','violence','other')),
  details text not null default ''
    check (char_length(details) <= 1000),
  status text not null default 'open'
    check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  constraint report_has_one_target check (
    (case when reported_user_id is not null then 1 else 0 end) +
    (case when reported_post_id is not null then 1 else 0 end) = 1
  )
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_not_self check (follower_id <> following_id)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  caption text not null default ''
    check (char_length(caption) <= 2200),
  media_path text,
  media_type text
    check (media_type in ('image', 'video') or media_type is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_have_content
    check (char_length(trim(caption)) > 0 or media_path is not null)
);

do $
begin
  alter table public.reports
    add constraint reports_post_fk
    foreign key (reported_post_id)
    references public.posts(id)
    on delete cascade;
exception
  when duplicate_object then null;
end
$;

create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null
    check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.saved_posts (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null
    check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint messages_not_self check (sender_id <> recipient_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  type text not null
    check (type in ('follow', 'like', 'comment', 'message')),
  entity_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists profiles_username_idx
  on public.profiles(username);

create index if not exists blocks_blocked_idx
  on public.blocks(blocked_id, created_at desc);

create index if not exists reports_reporter_idx
  on public.reports(reporter_id, created_at desc);

create index if not exists posts_created_at_idx
  on public.posts(created_at desc);

create index if not exists posts_author_idx
  on public.posts(author_id, created_at desc);

create index if not exists follows_following_idx
  on public.follows(following_id, created_at desc);

create index if not exists comments_post_idx
  on public.comments(post_id, created_at);

create index if not exists messages_sender_idx
  on public.messages(sender_id, created_at desc);

create index if not exists messages_recipient_idx
  on public.messages(recipient_id, created_at desc);

create index if not exists notifications_recipient_idx
  on public.notifications(recipient_id, created_at desc);

-- Public username availability check.
create or replace function public.is_username_available(candidate text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    lower(trim(candidate)) ~ '^[a-z0-9._]{3,30}$'
    and not exists (
      select 1
      from public.username_claims
      where username = lower(trim(candidate))
    );
$$;

grant execute on function public.is_username_available(text)
  to anon, authenticated;

-- Username is permanent after account creation.
create or replace function public.prevent_username_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.username is distinct from old.username then
    raise exception using
      errcode = '42501',
      message = 'USERNAME_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_username_change on public.profiles;
create trigger prevent_profile_username_change
before update of username on public.profiles
for each row execute function public.prevent_username_change();

-- Create a profile and permanently reserve the username at Auth signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text := lower(trim(coalesce(new.raw_user_meta_data->>'username', '')));
  display_name text := trim(coalesce(new.raw_user_meta_data->>'display_name', ''));
begin
  if uname !~ '^[a-z0-9._]{3,30}$' then
    raise exception using
      errcode = '22023',
      message = 'INVALID_USERNAME';
  end if;

  if char_length(display_name) < 1 or char_length(display_name) > 80 then
    raise exception using
      errcode = '22023',
      message = 'INVALID_DISPLAY_NAME';
  end if;

  insert into public.username_claims(username, claimed_by)
  values (uname, new.id);

  insert into public.profiles(id, username, display_name)
  values (new.id, uname, display_name);

  return new;
exception
  when unique_violation then
    raise exception using
      errcode = '23505',
      message = 'USERNAME_TAKEN';
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- updated_at helper.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at
before update on public.posts
for each row execute function public.touch_updated_at();

create or replace function public.users_blocked(first_user uuid, second_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $
  select exists (
    select 1
    from public.blocks
    where
      (blocker_id = first_user and blocked_id = second_user)
      or
      (blocker_id = second_user and blocked_id = first_user)
  );
$;

create or replace function public.handle_new_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $
begin
  delete from public.follows
  where
    (follower_id = new.blocker_id and following_id = new.blocked_id)
    or
    (follower_id = new.blocked_id and following_id = new.blocker_id);

  return new;
end;
$;

drop trigger if exists on_block_cleanup on public.blocks;
create trigger on_block_cleanup
after insert on public.blocks
for each row execute function public.handle_new_block();

-- RLS
alter table public.username_claims enable row level security;
alter table public.profiles enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.follows enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.saved_posts enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or not public.users_blocked(auth.uid(), id)
);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists blocks_read_self on public.blocks;
create policy blocks_read_self
on public.blocks
for select
to authenticated
using (blocker_id = auth.uid());

drop policy if exists blocks_insert_self on public.blocks;
create policy blocks_insert_self
on public.blocks
for insert
to authenticated
with check (blocker_id = auth.uid());

drop policy if exists blocks_delete_self on public.blocks;
create policy blocks_delete_self
on public.blocks
for delete
to authenticated
using (blocker_id = auth.uid());

drop policy if exists reports_read_self on public.reports;
create policy reports_read_self
on public.reports
for select
to authenticated
using (reporter_id = auth.uid());

drop policy if exists reports_insert_self on public.reports;
create policy reports_insert_self
on public.reports
for insert
to authenticated
with check (reporter_id = auth.uid());

drop policy if exists follows_read on public.follows;
create policy follows_read
on public.follows
for select
to authenticated
using (true);

drop policy if exists follows_insert_self on public.follows;
create policy follows_insert_self
on public.follows
for insert
to authenticated
with check (follower_id = auth.uid());

drop policy if exists follows_delete_self on public.follows;
create policy follows_delete_self
on public.follows
for delete
to authenticated
using (follower_id = auth.uid());

drop policy if exists posts_read on public.posts;
create policy posts_read
on public.posts
for select
to authenticated
using (
  author_id = auth.uid()
  or not public.users_blocked(auth.uid(), author_id)
);

drop policy if exists posts_insert_self on public.posts;
create policy posts_insert_self
on public.posts
for insert
to authenticated
with check (author_id = auth.uid());

drop policy if exists posts_update_self on public.posts;
create policy posts_update_self
on public.posts
for update
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

drop policy if exists posts_delete_self on public.posts;
create policy posts_delete_self
on public.posts
for delete
to authenticated
using (author_id = auth.uid());

drop policy if exists likes_read on public.likes;
create policy likes_read
on public.likes
for select
to authenticated
using (true);

drop policy if exists likes_insert_self on public.likes;
create policy likes_insert_self
on public.likes
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists likes_delete_self on public.likes;
create policy likes_delete_self
on public.likes
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists comments_read on public.comments;
create policy comments_read
on public.comments
for select
to authenticated
using (true);

drop policy if exists comments_insert_self on public.comments;
create policy comments_insert_self
on public.comments
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists comments_update_self on public.comments;
create policy comments_update_self
on public.comments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists comments_delete_self on public.comments;
create policy comments_delete_self
on public.comments
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists saved_read_self on public.saved_posts;
create policy saved_read_self
on public.saved_posts
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists saved_insert_self on public.saved_posts;
create policy saved_insert_self
on public.saved_posts
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists saved_delete_self on public.saved_posts;
create policy saved_delete_self
on public.saved_posts
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists messages_read_participant on public.messages;
create policy messages_read_participant
on public.messages
for select
to authenticated
using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and not public.users_blocked(sender_id, recipient_id)
);

drop policy if exists messages_mark_read_recipient on public.messages;
create policy messages_mark_read_recipient
on public.messages
for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

drop policy if exists messages_delete_sender on public.messages;
create policy messages_delete_sender
on public.messages
for delete
to authenticated
using (sender_id = auth.uid());

drop policy if exists notifications_read_self on public.notifications;
create policy notifications_read_self
on public.notifications
for select
to authenticated
using (recipient_id = auth.uid());

drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self
on public.notifications
for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

-- Notification triggers
create or replace function public.notify_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications(recipient_id, actor_id, type)
  values (new.following_id, new.follower_id, 'follow');
  return new;
end;
$$;

create or replace function public.notify_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
begin
  select author_id into post_author
  from public.posts
  where id = new.post_id;

  if post_author is not null and post_author <> new.user_id then
    insert into public.notifications(recipient_id, actor_id, type, entity_id)
    values (post_author, new.user_id, 'like', new.post_id);
  end if;

  return new;
end;
$$;

create or replace function public.notify_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
begin
  select author_id into post_author
  from public.posts
  where id = new.post_id;

  if post_author is not null and post_author <> new.user_id then
    insert into public.notifications(recipient_id, actor_id, type, entity_id)
    values (post_author, new.user_id, 'comment', new.post_id);
  end if;

  return new;
end;
$$;

create or replace function public.notify_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications(recipient_id, actor_id, type, entity_id)
  values (new.recipient_id, new.sender_id, 'message', new.id);
  return new;
end;
$$;

drop trigger if exists on_follow_notify on public.follows;
create trigger on_follow_notify
after insert on public.follows
for each row execute function public.notify_follow();

drop trigger if exists on_like_notify on public.likes;
create trigger on_like_notify
after insert on public.likes
for each row execute function public.notify_like();

drop trigger if exists on_comment_notify on public.comments;
create trigger on_comment_notify
after insert on public.comments
for each row execute function public.notify_comment();

drop trigger if exists on_message_notify on public.messages;
create trigger on_message_notify
after insert on public.messages
for each row execute function public.notify_message();

-- Public media bucket. Upload/delete restricted to the user's own top-level folder.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists media_insert_own on storage.objects;
create policy media_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists media_delete_own on storage.objects;
create policy media_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Realtime for direct messages and notifications.
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end
$$;
