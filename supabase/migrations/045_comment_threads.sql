-- Comment threads, likes, pagination and reply notifications.

alter table public.comments
  add column if not exists parent_id uuid
  references public.comments(id) on delete cascade;

create index if not exists comments_post_parent_created_idx
  on public.comments (post_id, parent_id, created_at desc);

create index if not exists comments_parent_created_idx
  on public.comments (parent_id, created_at asc)
  where parent_id is not null;

create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.comment_likes enable row level security;

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
    user_id = auth.uid()
    and exists (
      select 1
      from public.comments c
      join public.posts p on p.id = c.post_id
      where c.id = comment_likes.comment_id
        and not public.users_blocked(auth.uid(), c.user_id)
        and not public.users_blocked(auth.uid(), p.author_id)
    )
  );

drop policy if exists comment_likes_delete_self on public.comment_likes;
create policy comment_likes_delete_self
  on public.comment_likes
  for delete
  to authenticated
  using (user_id = auth.uid());

create or replace function public.normalize_comment_parent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_post uuid;
  root_parent uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'COMMENT_PARENT_INVALID';
  end if;

  select c.post_id, c.parent_id
  into parent_post, root_parent
  from public.comments c
  where c.id = new.parent_id;

  if parent_post is null or parent_post <> new.post_id then
    raise exception 'COMMENT_PARENT_INVALID';
  end if;

  if root_parent is not null then
    new.parent_id := root_parent;
  end if;

  return new;
end;
$$;

drop trigger if exists comments_normalize_parent on public.comments;
create trigger comments_normalize_parent
before insert or update of parent_id, post_id
on public.comments
for each row
execute function public.normalize_comment_parent();

create or replace function public.get_post_comments(
  target_post uuid,
  page_limit integer default 20,
  page_offset integer default 0
)
returns table (
  comment_id uuid,
  parent_id uuid,
  user_id uuid,
  body text,
  created_at timestamptz,
  username text,
  display_name text,
  avatar_url text,
  verified boolean,
  like_count bigint,
  viewer_liked boolean,
  reply_count bigint,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id as comment_id,
    c.parent_id,
    c.user_id,
    c.body,
    c.created_at,
    p.username,
    p.display_name,
    p.avatar_url,
    p.verified,
    (
      select count(*)
      from public.comment_likes cl
      where cl.comment_id = c.id
    ) as like_count,
    exists (
      select 1
      from public.comment_likes mine
      where mine.comment_id = c.id
        and mine.user_id = auth.uid()
    ) as viewer_liked,
    (
      select count(*)
      from public.comments replies
      where replies.parent_id = c.id
    ) as reply_count,
    count(*) over() as total_count
  from public.comments c
  join public.profiles p on p.id = c.user_id
  where auth.uid() is not null
    and c.post_id = target_post
    and c.parent_id is null
    and not public.users_blocked(auth.uid(), c.user_id)
  order by c.created_at desc, c.id
  limit least(greatest(page_limit, 1), 50)
  offset greatest(page_offset, 0);
$$;

revoke all on function public.get_post_comments(uuid, integer, integer)
  from public, anon;
grant execute on function public.get_post_comments(uuid, integer, integer)
  to authenticated;

create or replace function public.get_comment_replies(
  root_comment uuid,
  page_limit integer default 30,
  page_offset integer default 0
)
returns table (
  comment_id uuid,
  parent_id uuid,
  user_id uuid,
  body text,
  created_at timestamptz,
  username text,
  display_name text,
  avatar_url text,
  verified boolean,
  like_count bigint,
  viewer_liked boolean,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id as comment_id,
    c.parent_id,
    c.user_id,
    c.body,
    c.created_at,
    p.username,
    p.display_name,
    p.avatar_url,
    p.verified,
    (
      select count(*)
      from public.comment_likes cl
      where cl.comment_id = c.id
    ) as like_count,
    exists (
      select 1
      from public.comment_likes mine
      where mine.comment_id = c.id
        and mine.user_id = auth.uid()
    ) as viewer_liked,
    count(*) over() as total_count
  from public.comments c
  join public.profiles p on p.id = c.user_id
  where auth.uid() is not null
    and c.parent_id = root_comment
    and not public.users_blocked(auth.uid(), c.user_id)
  order by c.created_at asc, c.id
  limit least(greatest(page_limit, 1), 50)
  offset greatest(page_offset, 0);
$$;

revoke all on function public.get_comment_replies(uuid, integer, integer)
  from public, anon;
grant execute on function public.get_comment_replies(uuid, integer, integer)
  to authenticated;

create or replace function public.toggle_comment_like(target_comment uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if exists (
    select 1
    from public.comment_likes
    where comment_id = target_comment
      and user_id = auth.uid()
  ) then
    delete from public.comment_likes
    where comment_id = target_comment
      and user_id = auth.uid();
    return false;
  end if;

  insert into public.comment_likes(comment_id, user_id)
  values (target_comment, auth.uid());

  return true;
end;
$$;

revoke all on function public.toggle_comment_like(uuid) from public, anon;
grant execute on function public.toggle_comment_like(uuid) to authenticated;

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type = any (
      array[
        'follow'::text,
        'follow_request'::text,
        'follow_request_accepted'::text,
        'like'::text,
        'comment'::text,
        'reply'::text,
        'message'::text,
        'message_request'::text,
        'message_reply'::text,
        'message_reaction'::text,
        'collab_invite'::text,
        'collab_accepted'::text
      ]
    )
  );

create or replace function public.notify_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
  parent_author uuid;
begin
  select author_id
  into post_author
  from public.posts
  where id = new.post_id;

  if new.parent_id is not null then
    select user_id
    into parent_author
    from public.comments
    where id = new.parent_id;

    if parent_author is not null
       and parent_author <> new.user_id
       and public.notification_enabled(parent_author, 'comment') then
      insert into public.notifications(recipient_id, actor_id, type, entity_id)
      values (parent_author, new.user_id, 'reply', new.post_id);
    end if;
  end if;

  if post_author is not null
     and post_author <> new.user_id
     and post_author is distinct from parent_author
     and public.notification_enabled(post_author, 'comment') then
    insert into public.notifications(recipient_id, actor_id, type, entity_id)
    values (post_author, new.user_id, 'comment', new.post_id);
  end if;

  return new;
end;
$$;
