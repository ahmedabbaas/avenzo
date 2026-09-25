drop function if exists public.request_or_follow(uuid);
drop function if exists public.cancel_follow_or_request(uuid);
drop function if exists public.accept_follow_request(uuid);
drop function if exists public.decline_follow_request(uuid);

drop policy if exists follows_insert_self on public.follows;
create policy follows_insert_self
on public.follows
for insert to authenticated
with check (
  follower_id = (select auth.uid())
  and not public.users_blocked((select auth.uid()),following_id)
  and not coalesce((
    select ps.account_private
    from public.privacy_settings ps
    where ps.user_id=follows.following_id
  ),false)
  and public.audience_allows(
    (select auth.uid()),
    following_id,
    coalesce((
      select ps.who_can_follow
      from public.privacy_settings ps
      where ps.user_id=follows.following_id
    ),'everyone')
  )
);
