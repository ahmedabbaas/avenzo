create or replace function public.audience_allows(actor uuid, target uuid, audience text)
returns boolean
language sql
security definer
set search_path = public
stable
as $audience_allows$
  select actor = target
    or audience = 'everyone'
    or (
      audience = 'people_i_follow'
      and exists (
        select 1 from public.follows
        where follower_id = target and following_id = actor
      )
    );
$audience_allows$;

revoke execute on function public.audience_allows(uuid,uuid,text) from public, anon;
grant execute on function public.audience_allows(uuid,uuid,text) to authenticated;

create or replace function public.notification_enabled(recipient uuid, notification_type text)
returns boolean
language sql
security definer
set search_path = public
stable
as $notification_enabled$
  select coalesce(
    (
      select case notification_type
        when 'like' then notify_likes
        when 'comment' then notify_comments
        when 'follow' then notify_followers
        when 'message' then notify_messages
        else notify_other
      end
      from public.app_settings where user_id = recipient
    ),
    true
  );
$notification_enabled$;

revoke execute on function public.notification_enabled(uuid,text) from public, anon, authenticated;

create or replace function public.notify_follow()
returns trigger language plpgsql security definer set search_path = public
as $notify_follow_pref$
begin
  if public.notification_enabled(new.following_id, 'follow') then
    insert into public.notifications(recipient_id, actor_id, type)
    values (new.following_id, new.follower_id, 'follow');
  end if;
  return new;
end;
$notify_follow_pref$;

create or replace function public.notify_like()
returns trigger language plpgsql security definer set search_path = public
as $notify_like_pref$
declare post_author uuid;
begin
  select author_id into post_author from public.posts where id = new.post_id;
  if post_author is not null
     and post_author <> new.user_id
     and public.notification_enabled(post_author, 'like') then
    insert into public.notifications(recipient_id, actor_id, type, entity_id)
    values (post_author, new.user_id, 'like', new.post_id);
  end if;
  return new;
end;
$notify_like_pref$;

create or replace function public.notify_comment()
returns trigger language plpgsql security definer set search_path = public
as $notify_comment_pref$
declare post_author uuid;
begin
  select author_id into post_author from public.posts where id = new.post_id;
  if post_author is not null
     and post_author <> new.user_id
     and public.notification_enabled(post_author, 'comment') then
    insert into public.notifications(recipient_id, actor_id, type, entity_id)
    values (post_author, new.user_id, 'comment', new.post_id);
  end if;
  return new;
end;
$notify_comment_pref$;

create or replace function public.notify_message()
returns trigger language plpgsql security definer set search_path = public
as $notify_message_pref$
begin
  if public.notification_enabled(new.recipient_id, 'message') then
    insert into public.notifications(recipient_id, actor_id, type, entity_id)
    values (new.recipient_id, new.sender_id, 'message', new.id);
  end if;
  return new;
end;
$notify_message_pref$;

create or replace function public.notify_reel_like()
returns trigger language plpgsql security definer set search_path = public
as $notify_reel_like_pref$
declare reel_author uuid;
begin
  select author_id into reel_author from public.reels where id = new.reel_id;
  if reel_author is not null
     and reel_author <> new.user_id
     and public.notification_enabled(reel_author, 'like') then
    insert into public.notifications(recipient_id, actor_id, type, entity_id)
    values (reel_author, new.user_id, 'like', new.reel_id);
  end if;
  return new;
end;
$notify_reel_like_pref$;

create or replace function public.notify_reel_comment()
returns trigger language plpgsql security definer set search_path = public
as $notify_reel_comment_pref$
declare reel_author uuid;
begin
  select author_id into reel_author from public.reels where id = new.reel_id;
  if reel_author is not null
     and reel_author <> new.user_id
     and public.notification_enabled(reel_author, 'comment') then
    insert into public.notifications(recipient_id, actor_id, type, entity_id)
    values (reel_author, new.user_id, 'comment', new.reel_id);
  end if;
  return new;
end;
$notify_reel_comment_pref$;

drop policy if exists follows_insert_self on public.follows;
create policy follows_insert_self on public.follows
for insert to authenticated
with check (
  follower_id = auth.uid()
  and not public.users_blocked(auth.uid(), following_id)
  and public.audience_allows(
    auth.uid(), following_id,
    coalesce((select who_can_follow from public.privacy_settings where user_id = following_id), 'everyone')
  )
);

drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and not public.users_blocked(sender_id, recipient_id)
  and public.audience_allows(
    auth.uid(), recipient_id,
    coalesce((select who_can_message from public.privacy_settings where user_id = recipient_id), 'everyone')
  )
);

drop policy if exists comments_insert_self on public.comments;
create policy comments_insert_self on public.comments
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.posts p
    left join public.privacy_settings ps on ps.user_id = p.author_id
    where p.id = comments.post_id
      and not public.users_blocked(auth.uid(), p.author_id)
      and public.audience_allows(auth.uid(), p.author_id, coalesce(ps.who_can_comment, 'everyone'))
  )
);

drop policy if exists reel_comments_insert_self on public.reel_comments;
create policy reel_comments_insert_self on public.reel_comments
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.reels r
    left join public.privacy_settings ps on ps.user_id = r.author_id
    where r.id = reel_comments.reel_id
      and not public.users_blocked(auth.uid(), r.author_id)
      and public.audience_allows(auth.uid(), r.author_id, coalesce(ps.who_can_comment, 'everyone'))
  )
);

drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts
for select to authenticated
using (
  author_id = auth.uid()
  or (
    not public.users_blocked(auth.uid(), author_id)
    and (
      not coalesce((select account_private from public.privacy_settings where user_id = author_id), false)
      or exists (
        select 1 from public.follows
        where follower_id = auth.uid() and following_id = posts.author_id
      )
    )
  )
);

drop policy if exists reels_read on public.reels;
create policy reels_read on public.reels
for select to authenticated
using (
  author_id = auth.uid()
  or (
    not public.users_blocked(auth.uid(), author_id)
    and (
      not coalesce((select account_private from public.privacy_settings where user_id = author_id), false)
      or exists (
        select 1 from public.follows
        where follower_id = auth.uid() and following_id = reels.author_id
      )
    )
  )
);

drop policy if exists stories_read_followed on public.stories;
create policy stories_read_followed on public.stories
for select to authenticated
using (
  expires_at > now()
  and not public.users_blocked(auth.uid(), author_id)
  and (
    author_id = auth.uid()
    or coalesce((select story_visibility from public.privacy_settings where user_id = author_id), 'followers') = 'everyone'
    or (
      coalesce((select story_visibility from public.privacy_settings where user_id = author_id), 'followers') = 'followers'
      and exists (
        select 1 from public.follows
        where follower_id = auth.uid() and following_id = stories.author_id
      )
    )
  )
);
