-- AVENZO threaded comments + comment-like hardening
-- Idempotent so production instances that already have comment threads can adopt it safely.

alter table public.comments
  add column if not exists parent_id uuid references public.comments(id) on delete cascade;

create index if not exists comments_parent_created_idx
  on public.comments(post_id, parent_id, created_at);

create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists comment_likes_user_idx
  on public.comment_likes(user_id, created_at desc);

alter table public.comment_likes enable row level security;

grant select, insert, delete on public.comment_likes to authenticated;

drop policy if exists comment_likes_read on public.comment_likes;
create policy comment_likes_read
on public.comment_likes
for select
to authenticated
using (true);

drop policy if exists comment_likes_insert_self on public.comment_likes;
create policy comment_likes_insert_self
on public.comment_likes
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.comments c
    join public.posts p on p.id = c.post_id
    where c.id = comment_likes.comment_id
      and not public.users_blocked((select auth.uid()), c.user_id)
      and not public.users_blocked((select auth.uid()), p.author_id)
  )
);

drop policy if exists comment_likes_delete_self on public.comment_likes;
create policy comment_likes_delete_self
on public.comment_likes
for delete
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.validate_comment_parent()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  parent_post_id uuid;
  parent_parent_id uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select post_id, parent_id
    into parent_post_id, parent_parent_id
  from public.comments
  where id = new.parent_id;

  if parent_post_id is null or parent_post_id <> new.post_id then
    raise exception using
      errcode = '23514',
      message = 'COMMENT_PARENT_POST_MISMATCH';
  end if;

  if parent_parent_id is not null then
    raise exception using
      errcode = '23514',
      message = 'COMMENT_REPLY_DEPTH_EXCEEDED';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_comment_parent() from public, anon, authenticated;

drop trigger if exists validate_comment_parent_trigger on public.comments;
create trigger validate_comment_parent_trigger
before insert or update of parent_id, post_id on public.comments
for each row execute function public.validate_comment_parent();
