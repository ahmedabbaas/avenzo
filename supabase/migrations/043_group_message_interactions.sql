create or replace function public.react_group_message(
  target_message uuid,
  reaction_emoji text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid:=auth.uid(); gid uuid;
begin
  if uid is null then raise exception using errcode='42501',message='UNAUTHENTICATED'; end if;
  select gm.group_id into gid
  from public.group_messages gm
  where gm.id=target_message and gm.deleted_at is null;
  if gid is null or not public.current_user_is_group_member(gid) then
    raise exception using errcode='42501',message='NOT_GROUP_MEMBER';
  end if;
  if char_length(reaction_emoji)<1 or char_length(reaction_emoji)>16 then
    raise exception using errcode='22023',message='INVALID_REACTION';
  end if;
  insert into public.group_message_reactions(message_id,user_id,emoji)
  values(target_message,uid,reaction_emoji)
  on conflict(message_id,user_id)
  do update set emoji=excluded.emoji,created_at=now();
end;
$$;

revoke execute on function public.react_group_message(uuid,text) from public,anon;
grant execute on function public.react_group_message(uuid,text) to authenticated;

create or replace function public.remove_group_message_reaction(target_message uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid:=auth.uid();
begin
  delete from public.group_message_reactions
  where message_id=target_message and user_id=uid;
end;
$$;

revoke execute on function public.remove_group_message_reaction(uuid) from public,anon;
grant execute on function public.remove_group_message_reaction(uuid) to authenticated;

create or replace function public.edit_group_message(target_message uuid,next_body text)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid:=auth.uid(); gid uuid;
begin
  if uid is null then raise exception using errcode='42501',message='UNAUTHENTICATED'; end if;
  select gm.group_id into gid
  from public.group_messages gm
  where gm.id=target_message and gm.sender_id=uid and gm.deleted_at is null;
  if gid is null or not public.current_user_is_group_member(gid) then
    raise exception using errcode='42501',message='NOT_MESSAGE_OWNER';
  end if;
  if char_length(trim(next_body))<1 or char_length(trim(next_body))>5000 then
    raise exception using errcode='22023',message='INVALID_MESSAGE';
  end if;
  update public.group_messages
  set body=trim(next_body),updated_at=now(),edited_at=now()
  where id=target_message and sender_id=uid;
end;
$$;

revoke execute on function public.edit_group_message(uuid,text) from public,anon;
grant execute on function public.edit_group_message(uuid,text) to authenticated;

create or replace function public.delete_group_message(target_message uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid:=auth.uid(); gid uuid;
begin
  if uid is null then raise exception using errcode='42501',message='UNAUTHENTICATED'; end if;
  select gm.group_id into gid
  from public.group_messages gm
  where gm.id=target_message and gm.sender_id=uid and gm.deleted_at is null;
  if gid is null or not public.current_user_is_group_member(gid) then
    raise exception using errcode='42501',message='NOT_MESSAGE_OWNER';
  end if;
  update public.group_messages
  set body='',deleted_at=now(),updated_at=now()
  where id=target_message and sender_id=uid;
  delete from public.group_message_reactions where message_id=target_message;
end;
$$;

revoke execute on function public.delete_group_message(uuid) from public,anon;
grant execute on function public.delete_group_message(uuid) to authenticated;
