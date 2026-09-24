drop policy if exists app_settings_self on public.app_settings;
create policy app_settings_self on public.app_settings
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists privacy_settings_self on public.privacy_settings;
create policy privacy_settings_self on public.privacy_settings
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists follows_insert_self on public.follows;
create policy follows_insert_self on public.follows
for insert to authenticated
with check (
  follower_id = (select auth.uid())
  and not public.users_blocked((select auth.uid()), following_id)
  and public.audience_allows(
    (select auth.uid()),
    following_id,
    coalesce(
      (select who_can_follow from public.privacy_settings where user_id = following_id),
      'everyone'
    )
  )
);

drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender on public.messages
for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and not public.users_blocked(sender_id, recipient_id)
  and public.audience_allows(
    (select auth.uid()),
    recipient_id,
    coalesce(
      (select who_can_message from public.privacy_settings where user_id = recipient_id),
      'everyone'
    )
  )
);

drop policy if exists comments_insert_self on public.comments;
create policy comments_insert_self on public.comments
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.posts p
    left join public.privacy_settings ps on ps.user_id = p.author_id
    where p.id = comments.post_id
      and not public.users_blocked((select auth.uid()), p.author_id)
      and public.audience_allows(
        (select auth.uid()),
        p.author_id,
        coalesce(ps.who_can_comment, 'everyone')
      )
  )
);

drop policy if exists reel_comments_insert_self on public.reel_comments;
create policy reel_comments_insert_self on public.reel_comments
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.reels r
    left join public.privacy_settings ps on ps.user_id = r.author_id
    where r.id = reel_comments.reel_id
      and not public.users_blocked((select auth.uid()), r.author_id)
      and public.audience_allows(
        (select auth.uid()),
        r.author_id,
        coalesce(ps.who_can_comment, 'everyone')
      )
  )
);

drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts
for select to authenticated
using (
  author_id = (select auth.uid())
  or (
    not public.users_blocked((select auth.uid()), author_id)
    and (
      not coalesce(
        (select account_private from public.privacy_settings where user_id = author_id),
        false
      )
      or exists (
        select 1 from public.follows
        where follower_id = (select auth.uid())
          and following_id = posts.author_id
      )
    )
  )
);

drop policy if exists reels_read on public.reels;
create policy reels_read on public.reels
for select to authenticated
using (
  author_id = (select auth.uid())
  or (
    not public.users_blocked((select auth.uid()), author_id)
    and (
      not coalesce(
        (select account_private from public.privacy_settings where user_id = author_id),
        false
      )
      or exists (
        select 1 from public.follows
        where follower_id = (select auth.uid())
          and following_id = reels.author_id
      )
    )
  )
);

drop policy if exists stories_read_followed on public.stories;
create policy stories_read_followed on public.stories
for select to authenticated
using (
  expires_at > now()
  and not public.users_blocked((select auth.uid()), author_id)
  and (
    author_id = (select auth.uid())
    or coalesce(
      (select story_visibility from public.privacy_settings where user_id = author_id),
      'followers'
    ) = 'everyone'
    or (
      coalesce(
        (select story_visibility from public.privacy_settings where user_id = author_id),
        'followers'
      ) = 'followers'
      and exists (
        select 1 from public.follows
        where follower_id = (select auth.uid())
          and following_id = stories.author_id
      )
    )
  )
);
