create or replace function public.mark_conversation_read(cid uuid)
returns void
language plpgsql
security definer
set search_path=public
as $mark_read$
declare uid uuid:=auth.uid(); now_at timestamptz:=now();
begin
  if not public.is_conversation_participant(cid,uid) then
    raise exception using errcode='42501',message='NOT_A_PARTICIPANT';
  end if;

  update public.messages
  set delivered_at=coalesce(delivered_at,now_at),
      read_at=coalesce(read_at,now_at)
  where conversation_id=cid and recipient_id=uid and read_at is null;

  insert into public.conversation_user_state(
    conversation_id,user_id,last_read_at,last_delivered_at,updated_at
  )
  values(cid,uid,now_at,now_at,now_at)
  on conflict(conversation_id,user_id)
  do update set
    last_read_at=excluded.last_read_at,
    last_delivered_at=excluded.last_delivered_at,
    updated_at=excluded.updated_at;
end;
$mark_read$;

create or replace function public.mark_message_delivered(mid uuid)
returns void
language plpgsql
security definer
set search_path=public
as $mark_delivered$
declare uid uuid:=auth.uid();
begin
  update public.messages
  set delivered_at=coalesce(delivered_at,now())
  where id=mid and recipient_id=uid;
end;
$mark_delivered$;

revoke execute on function public.mark_conversation_read(uuid) from public,anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
revoke execute on function public.mark_message_delivered(uuid) from public,anon;
grant execute on function public.mark_message_delivered(uuid) to authenticated;

revoke update on public.messages from authenticated;

create or replace function public.get_dm_inbox(include_requests boolean default false)
returns table(
  conversation_id uuid,other_user_id uuid,username text,display_name text,avatar_url text,
  last_message text,last_message_type text,last_message_at timestamptz,unread_count bigint,
  request_status text,request_incoming boolean,muted boolean
)
language sql
security definer
set search_path=public
stable
as $dm_inbox_secure$
  with mine as (
    select cp.conversation_id
    from public.conversation_participants cp
    where cp.user_id=auth.uid() and cp.left_at is null
  )
  select
    c.id,other.user_id,p.username,p.display_name,p.avatar_url,
    case
      when lm.deleted_for_everyone_at is not null then 'Message deleted'
      when lm.message_type='text' then lm.body
      when lm.message_type='image' then 'Sent an image'
      when lm.message_type='video' then 'Sent a video'
      when lm.message_type='file' then 'Sent a file'
      when lm.message_type='audio' then 'Sent a voice message'
      when lm.message_type='shared_post' then 'Shared a post'
      when lm.message_type='shared_reel' then 'Shared a reel'
      when lm.message_type='shared_profile' then 'Shared a profile'
      else '' end,
    lm.message_type,coalesce(lm.created_at,c.created_at),
    (select count(*) from public.messages um
     where um.conversation_id=c.id and um.recipient_id=auth.uid()
       and um.read_at is null and um.deleted_for_everyone_at is null
       and um.created_at>coalesce(state.deleted_before,'epoch'::timestamptz)),
    coalesce(mr.status,'accepted'),
    coalesce(mr.recipient_id=auth.uid() and mr.status='pending',false),
    coalesce(state.muted,false)
  from mine
  join public.conversations c on c.id=mine.conversation_id
  join public.conversation_participants other
    on other.conversation_id=c.id and other.user_id<>auth.uid()
  join public.profiles p on p.id=other.user_id
  left join public.message_requests mr on mr.conversation_id=c.id
  left join public.conversation_user_state state
    on state.conversation_id=c.id and state.user_id=auth.uid()
  left join lateral (
    select m.*
    from public.messages m
    where m.conversation_id=c.id
      and m.created_at>coalesce(state.deleted_before,'epoch'::timestamptz)
      and not exists(
        select 1 from public.message_hidden h
        where h.message_id=m.id and h.user_id=auth.uid()
      )
    order by m.created_at desc limit 1
  ) lm on true
  where not public.users_blocked(auth.uid(),other.user_id)
    and (
      (include_requests and mr.status='pending' and mr.recipient_id=auth.uid())
      or
      (not include_requests and (
        mr.conversation_id is null or mr.status='accepted'
        or (mr.status='pending' and mr.requester_id=auth.uid())
      ))
    )
  order by coalesce(lm.created_at,c.last_message_at,c.created_at) desc;
$dm_inbox_secure$;
