create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 2200),
  media_path text not null,
  media_type text not null default 'video' check (media_type = 'video'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reel_likes (
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reel_id, user_id)
);

create table if not exists public.reel_comments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.saved_reels (
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reel_id, user_id)
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  media_path text not null,
  media_type text not null check (media_type in ('image','video')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint stories_expire_after_creation check (expires_at > created_at)
);

create index if not exists reels_author_created_idx on public.reels(author_id, created_at desc);
create index if not exists reels_created_idx on public.reels(created_at desc);
create index if not exists reel_likes_user_idx on public.reel_likes(user_id);
create index if not exists reel_comments_reel_idx on public.reel_comments(reel_id, created_at);
create index if not exists reel_comments_user_idx on public.reel_comments(user_id);
create index if not exists saved_reels_user_idx on public.saved_reels(user_id);
create index if not exists stories_author_expiry_idx on public.stories(author_id, expires_at desc);
create index if not exists stories_expiry_idx on public.stories(expires_at);

alter table public.reels enable row level security;
alter table public.reel_likes enable row level security;
alter table public.reel_comments enable row level security;
alter table public.saved_reels enable row level security;
alter table public.stories enable row level security;

drop policy if exists reels_read on public.reels;
create policy reels_read on public.reels for select to authenticated
using (author_id = auth.uid() or not public.users_blocked(auth.uid(), author_id));

drop policy if exists reels_insert_self on public.reels;
create policy reels_insert_self on public.reels for insert to authenticated
with check (author_id = auth.uid());

drop policy if exists reels_update_self on public.reels;
create policy reels_update_self on public.reels for update to authenticated
using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists reels_delete_self on public.reels;
create policy reels_delete_self on public.reels for delete to authenticated
using (author_id = auth.uid());

drop policy if exists reel_likes_read on public.reel_likes;
create policy reel_likes_read on public.reel_likes for select to authenticated using (true);

drop policy if exists reel_likes_insert_self on public.reel_likes;
create policy reel_likes_insert_self on public.reel_likes for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists reel_likes_delete_self on public.reel_likes;
create policy reel_likes_delete_self on public.reel_likes for delete to authenticated
using (user_id = auth.uid());

drop policy if exists reel_comments_read on public.reel_comments;
create policy reel_comments_read on public.reel_comments for select to authenticated using (true);

drop policy if exists reel_comments_insert_self on public.reel_comments;
create policy reel_comments_insert_self on public.reel_comments for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists reel_comments_update_self on public.reel_comments;
create policy reel_comments_update_self on public.reel_comments for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists reel_comments_delete_self on public.reel_comments;
create policy reel_comments_delete_self on public.reel_comments for delete to authenticated
using (user_id = auth.uid());

drop policy if exists saved_reels_read_self on public.saved_reels;
create policy saved_reels_read_self on public.saved_reels for select to authenticated
using (user_id = auth.uid());

drop policy if exists saved_reels_insert_self on public.saved_reels;
create policy saved_reels_insert_self on public.saved_reels for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists saved_reels_delete_self on public.saved_reels;
create policy saved_reels_delete_self on public.saved_reels for delete to authenticated
using (user_id = auth.uid());

drop policy if exists stories_read_followed on public.stories;
create policy stories_read_followed on public.stories for select to authenticated
using (
  expires_at > now()
  and (
    author_id = auth.uid()
    or exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid()
        and f.following_id = stories.author_id
    )
  )
  and not public.users_blocked(auth.uid(), author_id)
);

drop policy if exists stories_insert_self on public.stories;
create policy stories_insert_self on public.stories for insert to authenticated
with check (
  author_id = auth.uid()
  and expires_at <= created_at + interval '24 hours 5 minutes'
  and expires_at > created_at
);

drop policy if exists stories_delete_self on public.stories;
create policy stories_delete_self on public.stories for delete to authenticated
using (author_id = auth.uid());

drop trigger if exists reels_touch_updated_at on public.reels;
create trigger reels_touch_updated_at before update on public.reels
for each row execute function public.touch_updated_at();

create or replace function public.notify_reel_like()
returns trigger language plpgsql security definer set search_path = public
as $notify_reel_like$
declare reel_author uuid;
begin
  select author_id into reel_author from public.reels where id = new.reel_id;
  if reel_author is not null and reel_author <> new.user_id then
    insert into public.notifications(recipient_id, actor_id, type, entity_id)
    values (reel_author, new.user_id, 'like', new.reel_id);
  end if;
  return new;
end;
$notify_reel_like$;

create or replace function public.notify_reel_comment()
returns trigger language plpgsql security definer set search_path = public
as $notify_reel_comment$
declare reel_author uuid;
begin
  select author_id into reel_author from public.reels where id = new.reel_id;
  if reel_author is not null and reel_author <> new.user_id then
    insert into public.notifications(recipient_id, actor_id, type, entity_id)
    values (reel_author, new.user_id, 'comment', new.reel_id);
  end if;
  return new;
end;
$notify_reel_comment$;

revoke execute on function public.notify_reel_like() from public, anon, authenticated;
revoke execute on function public.notify_reel_comment() from public, anon, authenticated;

drop trigger if exists on_reel_like_notify on public.reel_likes;
create trigger on_reel_like_notify after insert on public.reel_likes
for each row execute function public.notify_reel_like();

drop trigger if exists on_reel_comment_notify on public.reel_comments;
create trigger on_reel_comment_notify after insert on public.reel_comments
for each row execute function public.notify_reel_comment();
