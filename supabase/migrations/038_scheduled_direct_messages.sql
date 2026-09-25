create extension if not exists pg_cron with schema extensions;

create table if not exists public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  reply_to_id uuid references public.messages(id) on delete set null,
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending','sent','cancelled','failed')),
  sent_message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  cancelled_at timestamptz,
  last_error text,
  constraint scheduled_messages_distinct_users check (sender_id <> recipient_id)
);

create index if not exists scheduled_messages_due_idx
  on public.scheduled_messages(scheduled_for) where status='pending';
create index if not exists scheduled_messages_sender_idx
  on public.scheduled_messages(sender_id, created_at desc);

alter table public.scheduled_messages enable row level security;

drop policy if exists scheduled_messages_read_self on public.scheduled_messages;
create policy scheduled_messages_read_self
on public.scheduled_messages for select to authenticated
using (sender_id=(select auth.uid()));

drop policy if exists scheduled_messages_delete_self on public.scheduled_messages;
create policy scheduled_messages_delete_self
on public.scheduled_messages for delete to authenticated
using (sender_id=(select auth.uid()) and status in ('pending','cancelled','failed'));

create or replace function public.schedule_direct_message(
  cid uuid,
  recipient uuid,
  message_body text,
  send_at timestamptz,
  reply_mid uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $schedule_dm$
declare
  uid uuid := auth.uid();
  sid uuid;
  clean_body text := btrim(coalesce(message_body,''));
  request_status text;
begin
  if uid is null then raise exception using errcode='42501', message='UNAUTHENTICATED'; end if;
  if cid is null or recipient is null or recipient=uid then
    raise exception using errcode='22023', message='INVALID_RECIPIENT';
  end if;
  if char_length(clean_body)=0 or char_length(clean_body)>5000 then
    raise exception using errcode='22023', message='INVALID_MESSAGE';
  end if;
  if send_at<=now()+interval '30 seconds' then
    raise exception using errcode='22023', message='SCHEDULE_TOO_SOON';
  end if;
  if send_at>now()+interval '30 days' then
    raise exception using errcode='22023', message='SCHEDULE_TOO_FAR';
  end if;
  if not public.is_conversation_participant(cid,uid)
     or not public.is_conversation_participant(cid,recipient) then
    raise exception using errcode='42501', message='NOT_A_PARTICIPANT';
  end if;
  if public.users_blocked(uid,recipient) then
    raise exception using errcode='42501', message='MESSAGING_BLOCKED';
  end if;

  select coalesce(mr.status,'accepted')
  into request_status
  from public.conversations c
  left join public.message_requests mr on mr.conversation_id=c.id
  where c.id=cid;

  if coalesce(request_status,'accepted')<>'accepted' then
    raise exception using errcode='42501', message='MESSAGE_REQUEST_NOT_ACCEPTED';
  end if;

  if reply_mid is not null and not exists (
    select 1 from public.messages m
    where m.id=reply_mid and m.conversation_id=cid
  ) then
    raise exception using errcode='22023', message='INVALID_REPLY_TARGET';
  end if;

  insert into public.scheduled_messages(
    conversation_id,sender_id,recipient_id,body,reply_to_id,scheduled_for
  )
  values(cid,uid,recipient,clean_body,reply_mid,send_at)
  returning id into sid;

  return sid;
end;
$schedule_dm$;

create or replace function public.cancel_scheduled_message(target_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $cancel_scheduled_dm$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception using errcode='42501', message='UNAUTHENTICATED'; end if;
  update public.scheduled_messages
  set status='cancelled',cancelled_at=now()
  where id=target_id and sender_id=uid and status='pending';
  if not found then
    raise exception using errcode='P0002', message='SCHEDULED_MESSAGE_NOT_FOUND';
  end if;
end;
$cancel_scheduled_dm$;

create or replace function public.deliver_due_scheduled_messages()
returns integer
language plpgsql
security definer
set search_path=public
as $deliver_scheduled_dms$
declare
  row public.scheduled_messages%rowtype;
  delivered integer := 0;
  new_message_id uuid;
  request_status text;
begin
  for row in
    select * from public.scheduled_messages sm
    where sm.status='pending' and sm.scheduled_for<=now()
    order by sm.scheduled_for
    for update skip locked
    limit 100
  loop
    begin
      if public.users_blocked(row.sender_id,row.recipient_id) then
        update public.scheduled_messages set status='failed',last_error='MESSAGING_BLOCKED' where id=row.id;
        continue;
      end if;

      if not exists (
        select 1 from public.conversation_participants cp
        where cp.conversation_id=row.conversation_id
          and cp.user_id=row.sender_id and cp.left_at is null
      ) or not exists (
        select 1 from public.conversation_participants cp
        where cp.conversation_id=row.conversation_id
          and cp.user_id=row.recipient_id and cp.left_at is null
      ) then
        update public.scheduled_messages set status='failed',last_error='NOT_A_PARTICIPANT' where id=row.id;
        continue;
      end if;

      select coalesce(mr.status,'accepted')
      into request_status
      from public.conversations c
      left join public.message_requests mr on mr.conversation_id=c.id
      where c.id=row.conversation_id;

      if coalesce(request_status,'accepted')<>'accepted' then
        update public.scheduled_messages set status='failed',last_error='MESSAGE_REQUEST_NOT_ACCEPTED' where id=row.id;
        continue;
      end if;

      insert into public.messages(
        conversation_id,sender_id,recipient_id,message_type,body,
        reply_to_id,created_at,updated_at
      )
      values(
        row.conversation_id,row.sender_id,row.recipient_id,'text',
        row.body,row.reply_to_id,now(),now()
      )
      returning id into new_message_id;

      update public.scheduled_messages
      set status='sent',sent_message_id=new_message_id,
          sent_at=now(),last_error=null
      where id=row.id;

      delivered:=delivered+1;
    exception when others then
      update public.scheduled_messages
      set status='failed',last_error=left(sqlerrm,500)
      where id=row.id;
    end;
  end loop;
  return delivered;
end;
$deliver_scheduled_dms$;

revoke execute on function public.schedule_direct_message(uuid,uuid,text,timestamptz,uuid)
from public,anon;
revoke execute on function public.cancel_scheduled_message(uuid)
from public,anon;
revoke execute on function public.deliver_due_scheduled_messages()
from public,anon,authenticated;
grant execute on function public.schedule_direct_message(uuid,uuid,text,timestamptz,uuid)
to authenticated;
grant execute on function public.cancel_scheduled_message(uuid)
to authenticated;

do $schedule_job$
declare existing_job bigint;
begin
  select jobid into existing_job
  from cron.job where jobname='avenzo-deliver-scheduled-dms' limit 1;
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'avenzo-deliver-scheduled-dms',
    '* * * * *',
    'select public.deliver_due_scheduled_messages();'
  );
end
$schedule_job$;
