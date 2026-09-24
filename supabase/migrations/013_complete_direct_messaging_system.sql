create or replace function public.direct_conversation_key(a uuid, b uuid)
returns text
language sql
immutable
strict
as $direct_key$
  select least(a::text,b::text) || ':' || greatest(a::text,b::text);
$direct_key$;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct')),
  direct_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  accepted_at timestamptz,
  left_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.conversation_user_state (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  muted boolean not null default false,
  archived boolean not null default false,
  deleted_before timestamptz,
  last_read_at timestamptz,
  last_delivered_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.message_requests (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','deleted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint message_requests_not_self check (requester_id <> recipient_id)
);

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('image','video','file','audio')),
  storage_path text not null,
  mime_type text not null,
  file_name text not null default '',
  size_bytes bigint not null default 0 check (size_bytes >= 0 and size_bytes <= 26214400),
  duration_seconds numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.message_hidden (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.restricted_accounts (
  restrictor_id uuid not null references public.profiles(id) on delete cascade,
  restricted_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (restrictor_id, restricted_id),
  constraint restricted_accounts_not_self check (restrictor_id <> restricted_id)
);

alter table public.privacy_settings
  add column if not exists who_can_send_message_requests text not null default 'everyone'
    check (who_can_send_message_requests in ('everyone','people_i_follow','no_one')),
  add column if not exists read_receipts boolean not null default true,
  add column if not exists online_status boolean not null default true;

alter table public.messages
  add column if not exists conversation_id uuid references public.conversations(id) on delete cascade,
  add column if not exists message_type text not null default 'text'
    check (message_type in ('text','image','video','file','audio','shared_post','shared_reel','shared_profile')),
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null,
  add column if not exists shared_post_id uuid references public.posts(id) on delete set null,
  add column if not exists shared_reel_id uuid references public.reels(id) on delete set null,
  add column if not exists shared_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists deleted_for_everyone_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.messages alter column body set default '';
alter table public.messages drop constraint if exists messages_body_check;

do $message_payload$
begin
  alter table public.messages
    add constraint messages_payload_check check (
      deleted_for_everyone_at is not null
      or char_length(trim(body)) between 1 and 5000
      or message_type in ('image','video','file','audio','shared_post','shared_reel','shared_profile')
    );
exception when duplicate_object then null;
end
$message_payload$;

insert into public.conversations(kind,direct_key,created_at,updated_at,last_message_at)
select 'direct', public.direct_conversation_key(sender_id, recipient_id),
       min(created_at), max(created_at), max(created_at)
from public.messages
where sender_id is not null and recipient_id is not null
group by public.direct_conversation_key(sender_id, recipient_id)
on conflict (direct_key) do update
set last_message_at = greatest(public.conversations.last_message_at, excluded.last_message_at),
    updated_at = greatest(public.conversations.updated_at, excluded.updated_at);

insert into public.conversation_participants(conversation_id,user_id,joined_at,accepted_at)
select c.id, p.user_id, min(m.created_at), min(m.created_at)
from public.messages m
join public.conversations c
  on c.direct_key = public.direct_conversation_key(m.sender_id,m.recipient_id)
cross join lateral (values (m.sender_id),(m.recipient_id)) p(user_id)
group by c.id,p.user_id
on conflict (conversation_id,user_id) do update
set accepted_at = coalesce(public.conversation_participants.accepted_at, excluded.accepted_at);

insert into public.conversation_user_state(conversation_id,user_id)
select conversation_id,user_id from public.conversation_participants
on conflict (conversation_id,user_id) do nothing;

update public.messages m
set conversation_id = c.id
from public.conversations c
where m.conversation_id is null
  and c.direct_key = public.direct_conversation_key(m.sender_id,m.recipient_id);

alter table public.messages alter column conversation_id set not null;

create index if not exists conversations_last_message_idx on public.conversations(last_message_at desc nulls last);
create index if not exists conversation_participants_user_idx on public.conversation_participants(user_id, conversation_id);
create index if not exists conversation_state_user_idx on public.conversation_user_state(user_id, updated_at desc);
create index if not exists message_requests_recipient_idx on public.message_requests(recipient_id,status,created_at desc);
create index if not exists message_requests_requester_idx on public.message_requests(requester_id,status,created_at desc);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id,created_at);
create index if not exists message_attachments_message_idx on public.message_attachments(message_id);
create index if not exists message_reactions_message_idx on public.message_reactions(message_id);
create index if not exists restricted_accounts_restricted_idx on public.restricted_accounts(restricted_id,created_at desc);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.conversation_user_state enable row level security;
alter table public.message_requests enable row level security;
alter table public.message_attachments enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_hidden enable row level security;
alter table public.restricted_accounts enable row level security;

create or replace function public.is_conversation_participant(cid uuid, uid uuid)
returns boolean language sql security definer set search_path=public stable
as $is_participant$
  select exists(
    select 1 from public.conversation_participants
    where conversation_id=cid and user_id=uid and left_at is null
  );
$is_participant$;

create or replace function public.get_direct_conversation(other_user uuid)
returns uuid language sql security definer set search_path=public stable
as $get_direct$
  select c.id from public.conversations c
  where c.direct_key=public.direct_conversation_key(auth.uid(),other_user)
    and public.is_conversation_participant(c.id,auth.uid())
  limit 1;
$get_direct$;

create or replace function public.get_or_create_direct_conversation(other_user uuid)
returns table(conversation_id uuid, request_status text)
language plpgsql security definer set search_path=public
as $get_or_create_dm$
declare
  uid uuid:=auth.uid(); cid uuid; target_message_pref text; request_pref text;
  target_follows_actor boolean; current_status text;
begin
  if uid is null then raise exception using errcode='42501',message='UNAUTHENTICATED'; end if;
  if other_user is null or other_user=uid then raise exception using errcode='22023',message='INVALID_RECIPIENT'; end if;
  if not exists(select 1 from public.profiles where id=other_user) then raise exception using errcode='P0002',message='USER_NOT_FOUND'; end if;
  if public.users_blocked(uid,other_user) then raise exception using errcode='42501',message='MESSAGING_BLOCKED'; end if;

  select coalesce(who_can_message,'everyone'),coalesce(who_can_send_message_requests,'everyone')
  into target_message_pref,request_pref
  from public.privacy_settings where user_id=other_user;
  target_message_pref:=coalesce(target_message_pref,'everyone');
  request_pref:=coalesce(request_pref,'everyone');

  select exists(select 1 from public.follows where follower_id=other_user and following_id=uid)
  into target_follows_actor;

  if target_message_pref='no_one' then raise exception using errcode='42501',message='MESSAGES_NOT_ALLOWED'; end if;
  if target_message_pref='people_i_follow' and not target_follows_actor then
    raise exception using errcode='42501',message='MESSAGES_NOT_ALLOWED';
  end if;
  if not target_follows_actor and request_pref in ('no_one','people_i_follow') then
    raise exception using errcode='42501',message='MESSAGE_REQUESTS_NOT_ALLOWED';
  end if;

  insert into public.conversations(kind,direct_key,created_at,updated_at)
  values('direct',public.direct_conversation_key(uid,other_user),now(),now())
  on conflict(direct_key) do update set updated_at=public.conversations.updated_at
  returning id into cid;

  insert into public.conversation_participants(conversation_id,user_id,accepted_at)
  values(cid,uid,now()) on conflict(conversation_id,user_id) do nothing;
  insert into public.conversation_participants(conversation_id,user_id,accepted_at)
  values(cid,other_user,case when target_follows_actor then now() else null end)
  on conflict(conversation_id,user_id) do nothing;

  insert into public.conversation_user_state(conversation_id,user_id)
  values(cid,uid),(cid,other_user)
  on conflict(conversation_id,user_id) do nothing;

  select status into current_status from public.message_requests where conversation_id=cid;
  if current_status is null then
    insert into public.message_requests(conversation_id,requester_id,recipient_id,status,responded_at)
    values(cid,uid,other_user,
      case when target_follows_actor then 'accepted' else 'pending' end,
      case when target_follows_actor then now() else null end);
    current_status:=case when target_follows_actor then 'accepted' else 'pending' end;
  elsif current_status in ('declined','deleted') then
    raise exception using errcode='42501',message='MESSAGE_REQUEST_CLOSED';
  end if;

  return query select cid,current_status;
end;
$get_or_create_dm$;

create or replace function public.can_send_message(cid uuid, uid uuid)
returns boolean language sql security definer set search_path=public stable
as $can_send$
  select public.is_conversation_participant(cid,uid)
    and not public.users_blocked(uid,(
      select cp.user_id from public.conversation_participants cp
      where cp.conversation_id=cid and cp.user_id<>uid limit 1
    ))
    and coalesce((
      select case
        when mr.status='accepted' then true
        when mr.status='pending' and mr.requester_id=uid
          and not exists(select 1 from public.messages m where m.conversation_id=cid)
        then true
        else false end
      from public.message_requests mr where mr.conversation_id=cid
    ),true);
$can_send$;

create or replace function public.accept_message_request(cid uuid)
returns void language plpgsql security definer set search_path=public
as $accept_request$
declare uid uuid:=auth.uid();
begin
  update public.message_requests set status='accepted',responded_at=now()
  where conversation_id=cid and recipient_id=uid and status='pending';
  if not found then raise exception using errcode='42501',message='REQUEST_NOT_AVAILABLE'; end if;
  update public.conversation_participants set accepted_at=coalesce(accepted_at,now())
  where conversation_id=cid and user_id=uid;
end;
$accept_request$;

create or replace function public.decline_message_request(cid uuid)
returns void language plpgsql security definer set search_path=public
as $decline_request$
declare uid uuid:=auth.uid();
begin
  update public.message_requests set status='declined',responded_at=now()
  where conversation_id=cid and recipient_id=uid and status='pending';
  if not found then raise exception using errcode='42501',message='REQUEST_NOT_AVAILABLE'; end if;
end;
$decline_request$;

create or replace function public.set_conversation_muted(cid uuid,next_muted boolean)
returns void language plpgsql security definer set search_path=public
as $mute_conversation$
declare uid uuid:=auth.uid();
begin
  if not public.is_conversation_participant(cid,uid) then
    raise exception using errcode='42501',message='NOT_A_PARTICIPANT';
  end if;
  insert into public.conversation_user_state(conversation_id,user_id,muted,updated_at)
  values(cid,uid,next_muted,now())
  on conflict(conversation_id,user_id) do update set muted=excluded.muted,updated_at=now();
end;
$mute_conversation$;

create or replace function public.delete_conversation_for_me(cid uuid)
returns void language plpgsql security definer set search_path=public
as $delete_conversation_me$
declare uid uuid:=auth.uid();
begin
  if not public.is_conversation_participant(cid,uid) then
    raise exception using errcode='42501',message='NOT_A_PARTICIPANT';
  end if;
  insert into public.conversation_user_state(conversation_id,user_id,deleted_before,updated_at)
  values(cid,uid,now(),now())
  on conflict(conversation_id,user_id) do update set deleted_before=now(),archived=false,updated_at=now();
end;
$delete_conversation_me$;

create or replace function public.edit_own_message(message_id uuid,next_body text)
returns void language plpgsql security definer set search_path=public
as $edit_message$
declare uid uuid:=auth.uid();
begin
  if char_length(trim(coalesce(next_body,''))) not between 1 and 5000 then
    raise exception using errcode='22023',message='INVALID_MESSAGE';
  end if;
  update public.messages set body=trim(next_body),edited_at=now(),updated_at=now()
  where id=message_id and sender_id=uid and message_type='text' and deleted_for_everyone_at is null;
  if not found then raise exception using errcode='42501',message='MESSAGE_NOT_EDITABLE'; end if;
end;
$edit_message$;

create or replace function public.delete_message_for_everyone(message_id uuid)
returns void language plpgsql security definer set search_path=public
as $delete_message_everyone$
declare uid uuid:=auth.uid();
begin
  update public.messages set body='',deleted_for_everyone_at=now(),updated_at=now()
  where id=message_id and sender_id=uid and deleted_for_everyone_at is null;
  if not found then raise exception using errcode='42501',message='MESSAGE_NOT_DELETABLE'; end if;
  delete from public.message_attachments
  where public.message_attachments.message_id=delete_message_for_everyone.message_id;
end;
$delete_message_everyone$;

create or replace function public.get_dm_inbox(include_requests boolean default false)
returns table(
  conversation_id uuid,other_user_id uuid,username text,display_name text,avatar_url text,
  last_message text,last_message_type text,last_message_at timestamptz,unread_count bigint,
  request_status text,request_incoming boolean,muted boolean
)
language sql security definer set search_path=public stable
as $dm_inbox$
  with mine as (
    select cp.conversation_id from public.conversation_participants cp
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
  join public.conversation_participants other on other.conversation_id=c.id and other.user_id<>auth.uid()
  join public.profiles p on p.id=other.user_id
  left join public.message_requests mr on mr.conversation_id=c.id
  left join public.conversation_user_state state on state.conversation_id=c.id and state.user_id=auth.uid()
  left join lateral (
    select m.* from public.messages m
    where m.conversation_id=c.id
      and m.created_at>coalesce(state.deleted_before,'epoch'::timestamptz)
      and not exists(select 1 from public.message_hidden h where h.message_id=m.id and h.user_id=auth.uid())
    order by m.created_at desc limit 1
  ) lm on true
  where
    (include_requests and mr.status='pending' and mr.recipient_id=auth.uid())
    or
    (not include_requests and (
      mr.conversation_id is null or mr.status='accepted'
      or (mr.status='pending' and mr.requester_id=auth.uid())
    ))
  order by coalesce(lm.created_at,c.last_message_at,c.created_at) desc;
$dm_inbox$;

drop policy if exists conversations_participant_read on public.conversations;
create policy conversations_participant_read on public.conversations for select to authenticated
using(public.is_conversation_participant(id,(select auth.uid())));

drop policy if exists conversation_participants_read on public.conversation_participants;
create policy conversation_participants_read on public.conversation_participants for select to authenticated
using(public.is_conversation_participant(conversation_id,(select auth.uid())));

drop policy if exists conversation_state_self on public.conversation_user_state;
create policy conversation_state_self on public.conversation_user_state for all to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

drop policy if exists message_requests_participant_read on public.message_requests;
create policy message_requests_participant_read on public.message_requests for select to authenticated
using(requester_id=(select auth.uid()) or recipient_id=(select auth.uid()));

drop policy if exists messages_read_conversation_participant on public.messages;
create policy messages_read_conversation_participant on public.messages for select to authenticated
using(
  public.is_conversation_participant(conversation_id,(select auth.uid()))
  and created_at>coalesce((
    select deleted_before from public.conversation_user_state
    where conversation_id=messages.conversation_id and user_id=(select auth.uid())
  ),'epoch'::timestamptz)
  and not exists(
    select 1 from public.message_hidden h
    where h.message_id=messages.id and h.user_id=(select auth.uid())
  )
);

drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender on public.messages for insert to authenticated
with check(sender_id=(select auth.uid()) and public.can_send_message(conversation_id,(select auth.uid())));

drop policy if exists messages_mark_read_recipient on public.messages;
create policy messages_mark_read_recipient on public.messages for update to authenticated
using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));

drop policy if exists attachments_participant_read on public.message_attachments;
create policy attachments_participant_read on public.message_attachments for select to authenticated
using(exists(
  select 1 from public.messages m
  where m.id=message_attachments.message_id
    and public.is_conversation_participant(m.conversation_id,(select auth.uid()))
));

drop policy if exists attachments_sender_insert on public.message_attachments;
create policy attachments_sender_insert on public.message_attachments for insert to authenticated
with check(
  uploader_id=(select auth.uid())
  and exists(select 1 from public.messages m where m.id=message_attachments.message_id and m.sender_id=(select auth.uid()))
);

drop policy if exists reactions_participant_read on public.message_reactions;
create policy reactions_participant_read on public.message_reactions for select to authenticated
using(exists(
  select 1 from public.messages m
  where m.id=message_reactions.message_id
    and public.is_conversation_participant(m.conversation_id,(select auth.uid()))
));

drop policy if exists reactions_self_insert on public.message_reactions;
create policy reactions_self_insert on public.message_reactions for insert to authenticated
with check(
  user_id=(select auth.uid())
  and exists(select 1 from public.messages m
    where m.id=message_reactions.message_id
      and public.is_conversation_participant(m.conversation_id,(select auth.uid())))
);

drop policy if exists reactions_self_update on public.message_reactions;
create policy reactions_self_update on public.message_reactions for update to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

drop policy if exists reactions_self_delete on public.message_reactions;
create policy reactions_self_delete on public.message_reactions for delete to authenticated
using(user_id=(select auth.uid()));

drop policy if exists hidden_self on public.message_hidden;
create policy hidden_self on public.message_hidden for all to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

drop policy if exists restricted_accounts_self on public.restricted_accounts;
create policy restricted_accounts_self on public.restricted_accounts for all to authenticated
using(restrictor_id=(select auth.uid())) with check(restrictor_id=(select auth.uid()));

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
check(type in ('follow','like','comment','message','message_request','message_reply','message_reaction'));

create or replace function public.touch_conversation_from_message()
returns trigger language plpgsql security definer set search_path=public
as $touch_dm$
begin
  update public.conversations set last_message_at=new.created_at,updated_at=now()
  where id=new.conversation_id;
  return new;
end;
$touch_dm$;

drop trigger if exists on_message_touch_conversation on public.messages;
create trigger on_message_touch_conversation after insert on public.messages
for each row execute function public.touch_conversation_from_message();

create or replace function public.notify_message()
returns trigger language plpgsql security definer set search_path=public
as $notify_dm$
declare notification_kind text:='message'; pending_request boolean:=false; restricted boolean:=false;
begin
  select exists(select 1 from public.message_requests
    where conversation_id=new.conversation_id and status='pending' and recipient_id=new.recipient_id)
  into pending_request;
  select exists(select 1 from public.restricted_accounts
    where restrictor_id=new.recipient_id and restricted_id=new.sender_id)
  into restricted;
  if restricted then return new; end if;
  if pending_request then notification_kind:='message_request';
  elsif new.reply_to_id is not null then notification_kind:='message_reply'; end if;
  if public.notification_enabled(new.recipient_id,'message') then
    insert into public.notifications(recipient_id,actor_id,type,entity_id)
    values(new.recipient_id,new.sender_id,notification_kind,new.id);
  end if;
  return new;
end;
$notify_dm$;

create or replace function public.notify_message_reaction()
returns trigger language plpgsql security definer set search_path=public
as $notify_dm_reaction$
declare owner_id uuid;
begin
  select sender_id into owner_id from public.messages where id=new.message_id;
  if owner_id is not null and owner_id<>new.user_id and public.notification_enabled(owner_id,'message') then
    insert into public.notifications(recipient_id,actor_id,type,entity_id)
    values(owner_id,new.user_id,'message_reaction',new.message_id);
  end if;
  return new;
end;
$notify_dm_reaction$;

drop trigger if exists on_message_reaction_notify on public.message_reactions;
create trigger on_message_reaction_notify after insert on public.message_reactions
for each row execute function public.notify_message_reaction();

drop trigger if exists messages_touch_updated_at on public.messages;
create trigger messages_touch_updated_at before update on public.messages
for each row execute function public.touch_updated_at();

drop trigger if exists reactions_touch_updated_at on public.message_reactions;
create trigger reactions_touch_updated_at before update on public.message_reactions
for each row execute function public.touch_updated_at();

drop trigger if exists conversation_state_touch_updated_at on public.conversation_user_state;
create trigger conversation_state_touch_updated_at before update on public.conversation_user_state
for each row execute function public.touch_updated_at();

revoke execute on function public.direct_conversation_key(uuid,uuid) from public,anon;
grant execute on function public.direct_conversation_key(uuid,uuid) to authenticated;
revoke execute on function public.is_conversation_participant(uuid,uuid) from public,anon;
grant execute on function public.is_conversation_participant(uuid,uuid) to authenticated;
revoke execute on function public.get_direct_conversation(uuid) from public,anon;
grant execute on function public.get_direct_conversation(uuid) to authenticated;
revoke execute on function public.get_or_create_direct_conversation(uuid) from public,anon;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;
revoke execute on function public.can_send_message(uuid,uuid) from public,anon;
grant execute on function public.can_send_message(uuid,uuid) to authenticated;
revoke execute on function public.accept_message_request(uuid) from public,anon;
grant execute on function public.accept_message_request(uuid) to authenticated;
revoke execute on function public.decline_message_request(uuid) from public,anon;
grant execute on function public.decline_message_request(uuid) to authenticated;
revoke execute on function public.set_conversation_muted(uuid,boolean) from public,anon;
grant execute on function public.set_conversation_muted(uuid,boolean) to authenticated;
revoke execute on function public.delete_conversation_for_me(uuid) from public,anon;
grant execute on function public.delete_conversation_for_me(uuid) to authenticated;
revoke execute on function public.edit_own_message(uuid,text) from public,anon;
grant execute on function public.edit_own_message(uuid,text) to authenticated;
revoke execute on function public.delete_message_for_everyone(uuid) from public,anon;
grant execute on function public.delete_message_for_everyone(uuid) to authenticated;
revoke execute on function public.get_dm_inbox(boolean) from public,anon;
grant execute on function public.get_dm_inbox(boolean) to authenticated;

do $realtime_reactions$
begin
  alter publication supabase_realtime add table public.message_reactions;
exception when duplicate_object then null;
end
$realtime_reactions$;

do $realtime_requests$
begin
  alter publication supabase_realtime add table public.message_requests;
exception when duplicate_object then null;
end
$realtime_requests$;

update storage.buckets
set allowed_mime_types=array[
  'image/jpeg','image/png','image/webp','image/gif',
  'video/mp4','video/webm','video/quicktime',
  'audio/webm','audio/mpeg','audio/mp4',
  'application/pdf','text/plain'
]::text[]
where id='media';
