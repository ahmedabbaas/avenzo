drop policy if exists stories_read_followed on public.stories;
create policy stories_read_followed
on public.stories
for select to authenticated
using (
  expires_at > now()
  and not public.users_blocked((select auth.uid()),author_id)
  and (
    author_id=(select auth.uid())
    or (
      (
        not coalesce((
          select ps.account_private
          from public.privacy_settings ps
          where ps.user_id=stories.author_id
        ),false)
        or exists (
          select 1
          from public.follows f
          where f.follower_id=(select auth.uid())
            and f.following_id=stories.author_id
        )
      )
      and (
        coalesce((
          select ps.story_visibility
          from public.privacy_settings ps
          where ps.user_id=stories.author_id
        ),'followers')='everyone'
        or (
          coalesce((
            select ps.story_visibility
            from public.privacy_settings ps
            where ps.user_id=stories.author_id
          ),'followers')='followers'
          and exists (
            select 1
            from public.follows f
            where f.follower_id=(select auth.uid())
              and f.following_id=stories.author_id
          )
        )
        or (
          coalesce((
            select ps.story_visibility
            from public.privacy_settings ps
            where ps.user_id=stories.author_id
          ),'followers')='close_friends'
          and exists (
            select 1
            from public.close_friends cf
            where cf.user_id=stories.author_id
              and cf.friend_id=(select auth.uid())
          )
        )
      )
    )
  )
);
