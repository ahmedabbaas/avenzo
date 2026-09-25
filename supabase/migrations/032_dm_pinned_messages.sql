create table if not exists public.message_pins (
  conversation_id uuid not null
    references public.conversations(id) on delete cascade,
  message_id uuid not null
    references public.messages(id) on delete cascade,
  pinned_by uuid not null
    references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id,message_id)
);

create index if not exists message_pins_message_idx
  on public.message_pins(message_id);

alter table public.message_pins enable row level security;

drop policy if exists message_pins_participant_read on public.message_pins;
create policy message_pins_participant_read
on public.message_pins
for select to authenticated
using (
  public.is_conversation_participant(
    conversation_id,
    (select auth.uid())
  )
);

create or replace function public.set_message_pinned(
  mid uuid,
  next_pinned boolean
)
returns void
language plpgsql
security definer
set search_path=public
as $set_message_pinned$
declare
  uid uuid := auth.uid();
  cid uuid;
  pin_count integer;
begin
  if uid is null then
    raise exception using errcode='42501', message='UNAUTHENTICATED';
  end if;

  select m.conversation_id
  into cid
  from public.messages m
  where m.id=mid
    and m.deleted_for_everyone_at is null;

  if cid is null then
    raise exception using errcode='P0002', message='MESSAGE_NOT_FOUND';
  end if;

  if not public.is_conversation_participant(cid,uid) then
    raise exception using errcode='42501', message='NOT_A_PARTICIPANT';
  end if;

  if next_pinned then
    select count(*)
    into pin_count
    from public.message_pins p
    where p.conversation_id=cid
      and p.message_id<>mid;

    if pin_count>=3 then
      raise exception using errcode='22023', message='PINNED_MESSAGE_LIMIT';
    end if;

    insert into public.message_pins(
      conversation_id,message_id,pinned_by,created_at
    )
    values(cid,mid,uid,now())
    on conflict (conversation_id,message_id)
    do update set pinned_by=excluded.pinned_by,created_at=now();
  else
    delete from public.message_pins p
    where p.conversation_id=cid
      and p.message_id=mid;
  end if;
end;
$set_message_pinned$;

revoke execute on function public.set_message_pinned(uuid,boolean)
from public,anon;
grant execute on function public.set_message_pinned(uuid,boolean)
to authenticated;

create or replace function public.get_pinned_messages(cid uuid)
returns table(
  message_id uuid,
  sender_id uuid,
  message_type text,
  body text,
  created_at timestamptz,
  pinned_at timestamptz,
  pinned_by uuid
)
language sql
security definer
set search_path=public
stable
as $get_pinned_messages$
  select
    m.id,
    m.sender_id,
    m.message_type,
    m.body,
    m.created_at,
    p.created_at,
    p.pinned_by
  from public.message_pins p
  join public.messages m on m.id=p.message_id
  where p.conversation_id=cid
    and public.is_conversation_participant(cid,auth.uid())
    and m.deleted_for_everyone_at is null
  order by p.created_at desc
  limit 3;
$get_pinned_messages$;

revoke execute on function public.get_pinned_messages(uuid)
from public,anon;
grant execute on function public.get_pinned_messages(uuid)
to authenticated;

do $message_pins_realtime$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='message_pins'
  ) then
    alter publication supabase_realtime add table public.message_pins;
  end if;
end
$message_pins_realtime$;
