drop policy if exists follow_requests_parties_update on public.follow_requests;
drop policy if exists follow_requests_target_update on public.follow_requests;
create policy follow_requests_target_update
on public.follow_requests
for update to authenticated
using (target_id = (select auth.uid()))
with check (target_id = (select auth.uid()));

drop policy if exists follow_requests_requester_delete on public.follow_requests;
create policy follow_requests_requester_delete
on public.follow_requests
for delete to authenticated
using (
  requester_id = (select auth.uid())
  or target_id = (select auth.uid())
);

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'follow','follow_request','follow_request_accepted',
      'like','comment','message','message_request',
      'message_reply','message_reaction'
    )
  );

create or replace function public.get_follow_relationship(target_user uuid)
returns table(state text,target_private boolean)
language plpgsql
security definer
set search_path=public
stable
as $follow_relationship$
declare
  uid uuid := auth.uid();
  private_account boolean := false;
begin
  if uid is null then
    raise exception using errcode='42501', message='UNAUTHENTICATED';
  end if;
  if target_user is null then
    raise exception using errcode='22023', message='INVALID_TARGET';
  end if;

  select coalesce(ps.account_private,false)
  into private_account
  from public.privacy_settings ps
  where ps.user_id=target_user;

  private_account := coalesce(private_account,false);

  if target_user=uid then
    return query select 'self'::text, private_account;
    return;
  end if;

  if exists (
    select 1 from public.follows f
    where f.follower_id=uid and f.following_id=target_user
  ) then
    return query select 'following'::text, private_account;
    return;
  end if;

  if exists (
    select 1 from public.follow_requests fr
    where fr.requester_id=uid
      and fr.target_id=target_user
      and fr.status='pending'
  ) then
    return query select 'requested'::text, private_account;
    return;
  end if;

  return query select 'none'::text, private_account;
end;
$follow_relationship$;

create or replace function public.request_or_follow_user(target_user uuid)
returns text
language plpgsql
security definer
set search_path=public
as $request_or_follow$
declare
  uid uuid := auth.uid();
  follow_pref text := 'everyone';
  private_account boolean := false;
  target_follows_actor boolean := false;
begin
  if uid is null then
    raise exception using errcode='42501', message='UNAUTHENTICATED';
  end if;
  if target_user is null or target_user=uid then
    raise exception using errcode='22023', message='INVALID_TARGET';
  end if;
  if not exists(select 1 from public.profiles p where p.id=target_user) then
    raise exception using errcode='P0002', message='USER_NOT_FOUND';
  end if;
  if public.users_blocked(uid,target_user) then
    raise exception using errcode='42501', message='FOLLOW_BLOCKED';
  end if;

  if exists (
    select 1 from public.follows f
    where f.follower_id=uid and f.following_id=target_user
  ) then
    return 'following';
  end if;

  select coalesce(ps.who_can_follow,'everyone'),
         coalesce(ps.account_private,false)
  into follow_pref, private_account
  from public.privacy_settings ps
  where ps.user_id=target_user;

  follow_pref := coalesce(follow_pref,'everyone');
  private_account := coalesce(private_account,false);

  select exists (
    select 1 from public.follows f
    where f.follower_id=target_user and f.following_id=uid
  )
  into target_follows_actor;

  if follow_pref='no_one' then
    raise exception using errcode='42501', message='FOLLOW_NOT_ALLOWED';
  end if;
  if follow_pref='people_i_follow' and not target_follows_actor then
    raise exception using errcode='42501', message='FOLLOW_NOT_ALLOWED';
  end if;

  if private_account then
    insert into public.follow_requests(
      requester_id,target_id,status,created_at,responded_at
    )
    values(uid,target_user,'pending',now(),null)
    on conflict (requester_id,target_id)
    do update set status='pending',created_at=now(),responded_at=null;

    delete from public.notifications n
    where n.recipient_id=target_user
      and n.actor_id=uid
      and n.type='follow_request'
      and n.read_at is null;

    insert into public.notifications(recipient_id,actor_id,type)
    values(target_user,uid,'follow_request');

    return 'requested';
  end if;

  delete from public.follow_requests fr
  where fr.requester_id=uid and fr.target_id=target_user;

  insert into public.follows(follower_id,following_id)
  values(uid,target_user)
  on conflict do nothing;

  return 'following';
end;
$request_or_follow$;

create or replace function public.unfollow_or_cancel_request(target_user uuid)
returns text
language plpgsql
security definer
set search_path=public
as $unfollow_or_cancel$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception using errcode='42501', message='UNAUTHENTICATED';
  end if;
  if target_user is null or target_user=uid then
    raise exception using errcode='22023', message='INVALID_TARGET';
  end if;

  delete from public.follows f
  where f.follower_id=uid and f.following_id=target_user;

  delete from public.follow_requests fr
  where fr.requester_id=uid
    and fr.target_id=target_user
    and fr.status='pending';

  delete from public.notifications n
  where n.recipient_id=target_user
    and n.actor_id=uid
    and n.type='follow_request'
    and n.read_at is null;

  return 'none';
end;
$unfollow_or_cancel$;

create or replace function public.respond_follow_request(
  requester uuid,
  accept_request boolean
)
returns text
language plpgsql
security definer
set search_path=public
as $respond_follow_request$
declare
  uid uuid := auth.uid();
  request_exists boolean;
begin
  if uid is null then
    raise exception using errcode='42501', message='UNAUTHENTICATED';
  end if;
  if requester is null or requester=uid then
    raise exception using errcode='22023', message='INVALID_REQUESTER';
  end if;

  select exists (
    select 1 from public.follow_requests fr
    where fr.requester_id=requester
      and fr.target_id=uid
      and fr.status='pending'
  )
  into request_exists;

  if not request_exists then
    raise exception using errcode='P0002', message='FOLLOW_REQUEST_NOT_FOUND';
  end if;

  if accept_request then
    update public.follow_requests fr
    set status='accepted',responded_at=now()
    where fr.requester_id=requester
      and fr.target_id=uid
      and fr.status='pending';

    insert into public.follows(follower_id,following_id)
    values(requester,uid)
    on conflict do nothing;

    insert into public.notifications(recipient_id,actor_id,type)
    values(requester,uid,'follow_request_accepted');

    return 'accepted';
  end if;

  update public.follow_requests fr
  set status='declined',responded_at=now()
  where fr.requester_id=requester
    and fr.target_id=uid
    and fr.status='pending';

  return 'declined';
end;
$respond_follow_request$;

create or replace function public.notify_follow()
returns trigger
language plpgsql
security definer
set search_path=public
as $notify_follow$
begin
  if exists (
    select 1 from public.follow_requests fr
    where fr.requester_id=new.follower_id
      and fr.target_id=new.following_id
      and fr.status='accepted'
  ) then
    return new;
  end if;

  if public.notification_enabled(new.following_id,'follow') then
    insert into public.notifications(recipient_id,actor_id,type)
    values(new.following_id,new.follower_id,'follow');
  end if;

  return new;
end;
$notify_follow$;

revoke execute on function public.get_follow_relationship(uuid)
from public,anon;
revoke execute on function public.request_or_follow_user(uuid)
from public,anon;
revoke execute on function public.unfollow_or_cancel_request(uuid)
from public,anon;
revoke execute on function public.respond_follow_request(uuid,boolean)
from public,anon;

grant execute on function public.get_follow_relationship(uuid) to authenticated;
grant execute on function public.request_or_follow_user(uuid) to authenticated;
grant execute on function public.unfollow_or_cancel_request(uuid) to authenticated;
grant execute on function public.respond_follow_request(uuid,boolean) to authenticated;
