create or replace function public.get_dm_messages(cid uuid)
returns table(
  id uuid,conversation_id uuid,sender_id uuid,recipient_id uuid,message_type text,
  body text,reply_to_id uuid,shared_post_id uuid,shared_reel_id uuid,
  shared_profile_id uuid,created_at timestamptz,updated_at timestamptz,
  edited_at timestamptz,delivered_at timestamptz,read_at timestamptz,
  deleted_for_everyone_at timestamptz
)
language plpgsql
security definer
set search_path=public
stable
as $get_dm_messages$
declare uid uuid:=auth.uid();
begin
  if not public.is_conversation_participant(cid,uid) then
    raise exception using errcode='42501',message='NOT_A_PARTICIPANT';
  end if;

  return query
  select
    q.id,q.conversation_id,q.sender_id,q.recipient_id,q.message_type,q.body,
    q.reply_to_id,q.shared_post_id,q.shared_reel_id,q.shared_profile_id,
    q.created_at,q.updated_at,q.edited_at,q.delivered_at,q.read_at,
    q.deleted_for_everyone_at
  from (
    select
      m.id,m.conversation_id,m.sender_id,m.recipient_id,m.message_type,m.body,
      m.reply_to_id,m.shared_post_id,m.shared_reel_id,m.shared_profile_id,
      m.created_at,m.updated_at,m.edited_at,m.delivered_at,
      case
        when m.sender_id=uid
          and not coalesce(
            (select ps.read_receipts
             from public.privacy_settings ps
             where ps.user_id=m.recipient_id),
            true
          )
        then null
        else m.read_at
      end as read_at,
      m.deleted_for_everyone_at
    from public.messages m
    where m.conversation_id=cid
      and m.created_at>coalesce(
        (select s.deleted_before
         from public.conversation_user_state s
         where s.conversation_id=cid and s.user_id=uid),
        'epoch'::timestamptz
      )
      and not exists(
        select 1
        from public.message_hidden h
        where h.message_id=m.id and h.user_id=uid
      )
    order by m.created_at desc
    limit 500
  ) q
  order by q.created_at asc;
end;
$get_dm_messages$;

revoke execute on function public.get_dm_messages(uuid) from public,anon;
grant execute on function public.get_dm_messages(uuid) to authenticated;
