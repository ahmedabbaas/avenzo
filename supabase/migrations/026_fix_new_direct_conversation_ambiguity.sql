create or replace function public.get_or_create_direct_conversation(other_user uuid)
returns table(conversation_id uuid, request_status text)
language plpgsql
security definer
set search_path=public
as $get_or_create_dm$
declare
  uid uuid := auth.uid();
  cid uuid;
  target_message_pref text;
  request_pref text;
  target_follows_actor boolean;
  current_status text;
begin
  if uid is null then
    raise exception using errcode='42501', message='UNAUTHENTICATED';
  end if;

  if other_user is null or other_user = uid then
    raise exception using errcode='22023', message='INVALID_RECIPIENT';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = other_user
  ) then
    raise exception using errcode='P0002', message='USER_NOT_FOUND';
  end if;

  if public.users_blocked(uid, other_user) then
    raise exception using errcode='42501', message='MESSAGING_BLOCKED';
  end if;

  select
    coalesce(ps.who_can_message, 'everyone'),
    coalesce(ps.who_can_send_message_requests, 'everyone')
  into target_message_pref, request_pref
  from public.privacy_settings ps
  where ps.user_id = other_user;

  target_message_pref := coalesce(target_message_pref, 'everyone');
  request_pref := coalesce(request_pref, 'everyone');

  select exists (
    select 1
    from public.follows f
    where f.follower_id = other_user
      and f.following_id = uid
  )
  into target_follows_actor;

  if target_message_pref = 'no_one' then
    raise exception using errcode='42501', message='MESSAGES_NOT_ALLOWED';
  end if;

  if target_message_pref = 'people_i_follow' and not target_follows_actor then
    raise exception using errcode='42501', message='MESSAGES_NOT_ALLOWED';
  end if;

  if not target_follows_actor
     and request_pref in ('no_one','people_i_follow') then
    raise exception using errcode='42501', message='MESSAGE_REQUESTS_NOT_ALLOWED';
  end if;

  insert into public.conversations(kind, direct_key, created_at, updated_at)
  values (
    'direct',
    public.direct_conversation_key(uid, other_user),
    now(),
    now()
  )
  on conflict (direct_key)
  do update set updated_at = public.conversations.updated_at
  returning public.conversations.id into cid;

  insert into public.conversation_participants(
    conversation_id,
    user_id,
    accepted_at
  )
  values (cid, uid, now())
  on conflict on constraint conversation_participants_pkey do nothing;

  insert into public.conversation_participants(
    conversation_id,
    user_id,
    accepted_at
  )
  values (
    cid,
    other_user,
    case when target_follows_actor then now() else null end
  )
  on conflict on constraint conversation_participants_pkey do nothing;

  insert into public.conversation_user_state(conversation_id, user_id)
  values (cid, uid), (cid, other_user)
  on conflict on constraint conversation_user_state_pkey do nothing;

  select mr.status
  into current_status
  from public.message_requests mr
  where mr.conversation_id = cid;

  if current_status is null then
    insert into public.message_requests(
      conversation_id,
      requester_id,
      recipient_id,
      status,
      responded_at
    )
    values (
      cid,
      uid,
      other_user,
      case when target_follows_actor then 'accepted' else 'pending' end,
      case when target_follows_actor then now() else null end
    );

    current_status :=
      case when target_follows_actor then 'accepted' else 'pending' end;
  elsif current_status in ('declined','deleted') then
    raise exception using errcode='42501', message='MESSAGE_REQUEST_CLOSED';
  end if;

  return query
  select cid, current_status;
end;
$get_or_create_dm$;

revoke execute on function public.get_or_create_direct_conversation(uuid)
from public, anon;
grant execute on function public.get_or_create_direct_conversation(uuid)
to authenticated;
