create table if not exists public.group_chats (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 80),
  avatar_url text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz
);

create table if not exists public.group_members (
  group_id uuid not null references public.group_chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (group_id,user_id)
);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.group_chats(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  message_type text not null default 'text'
    check (message_type in ('text','image','video','file','audio')),
  reply_to_id uuid references public.group_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint group_messages_payload_check check (
    deleted_at is not null
    or char_length(trim(body)) between 1 and 5000
    or message_type in ('image','video','file','audio')
  )
);

create table if not exists public.group_message_reactions (
  message_id uuid not null references public.group_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key(message_id,user_id)
);

create index if not exists group_members_user_idx
  on public.group_members(user_id,group_id)
  where left_at is null;
create index if not exists group_messages_group_created_idx
  on public.group_messages(group_id,created_at);
create index if not exists group_chats_last_message_idx
  on public.group_chats(last_message_at desc nulls last);

alter table public.group_chats enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;
alter table public.group_message_reactions enable row level security;

create or replace function public.is_group_member(gid uuid, uid uuid)
returns boolean
language sql
security definer
set search_path=public
stable
as $$
  select exists(
    select 1 from public.group_members gm
    where gm.group_id=gid
      and gm.user_id=uid
      and gm.left_at is null
  );
$$;

create or replace function public.is_group_admin(gid uuid, uid uuid)
returns boolean
language sql
security definer
set search_path=public
stable
as $$
  select exists(
    select 1 from public.group_members gm
    where gm.group_id=gid
      and gm.user_id=uid
      and gm.left_at is null
      and gm.role in ('owner','admin')
  );
$$;

revoke execute on function public.is_group_member(uuid,uuid) from public,anon;
grant execute on function public.is_group_member(uuid,uuid) to authenticated;
revoke execute on function public.is_group_admin(uuid,uuid) from public,anon;
grant execute on function public.is_group_admin(uuid,uuid) to authenticated;

drop policy if exists group_chats_member_read on public.group_chats;
create policy group_chats_member_read
on public.group_chats for select to authenticated
using (public.is_group_member(id,(select auth.uid())));

drop policy if exists group_members_member_read on public.group_members;
create policy group_members_member_read
on public.group_members for select to authenticated
using (public.is_group_member(group_id,(select auth.uid())));

drop policy if exists group_messages_member_read on public.group_messages;
create policy group_messages_member_read
on public.group_messages for select to authenticated
using (public.is_group_member(group_id,(select auth.uid())));

drop policy if exists group_messages_member_insert on public.group_messages;
create policy group_messages_member_insert
on public.group_messages for insert to authenticated
with check (
  sender_id=(select auth.uid())
  and public.is_group_member(group_id,(select auth.uid()))
);

drop policy if exists group_messages_sender_update on public.group_messages;
create policy group_messages_sender_update
on public.group_messages for update to authenticated
using (
  sender_id=(select auth.uid())
  and public.is_group_member(group_id,(select auth.uid()))
)
with check (
  sender_id=(select auth.uid())
  and public.is_group_member(group_id,(select auth.uid()))
);

drop policy if exists group_reactions_member_read on public.group_message_reactions;
create policy group_reactions_member_read
on public.group_message_reactions for select to authenticated
using (
  exists(
    select 1
    from public.group_messages gm
    where gm.id=group_message_reactions.message_id
      and public.is_group_member(gm.group_id,(select auth.uid()))
  )
);

drop policy if exists group_reactions_member_write on public.group_message_reactions;
create policy group_reactions_member_write
on public.group_message_reactions for all to authenticated
using (
  user_id=(select auth.uid())
  and exists(
    select 1
    from public.group_messages gm
    where gm.id=group_message_reactions.message_id
      and public.is_group_member(gm.group_id,(select auth.uid()))
  )
)
with check (
  user_id=(select auth.uid())
  and exists(
    select 1
    from public.group_messages gm
    where gm.id=group_message_reactions.message_id
      and public.is_group_member(gm.group_id,(select auth.uid()))
  )
);

create or replace function public.create_group_chat(group_title text, member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  gid uuid;
  member_id uuid;
  unique_members uuid[];
begin
  if uid is null then
    raise exception using errcode='42501',message='UNAUTHENTICATED';
  end if;
  if char_length(trim(group_title))<1 or char_length(trim(group_title))>80 then
    raise exception using errcode='22023',message='INVALID_GROUP_TITLE';
  end if;
  select array_agg(distinct x) into unique_members
  from unnest(coalesce(member_ids,'{}'::uuid[])) x
  where x is not null and x<>uid;
  if coalesce(array_length(unique_members,1),0)<1 then
    raise exception using errcode='22023',message='GROUP_NEEDS_MEMBER';
  end if;
  if coalesce(array_length(unique_members,1),0)>49 then
    raise exception using errcode='22023',message='GROUP_TOO_LARGE';
  end if;
  if exists(
    select 1 from unnest(unique_members) x
    where not exists(select 1 from public.profiles p where p.id=x)
  ) then
    raise exception using errcode='22023',message='INVALID_GROUP_MEMBER';
  end if;
  insert into public.group_chats(title,created_by)
  values(trim(group_title),uid)
  returning id into gid;
  insert into public.group_members(group_id,user_id,role)
  values(gid,uid,'owner');
  foreach member_id in array unique_members loop
    insert into public.group_members(group_id,user_id,role)
    values(gid,member_id,'member');
  end loop;
  return gid;
end;
$$;

revoke execute on function public.create_group_chat(text,uuid[]) from public,anon;
grant execute on function public.create_group_chat(text,uuid[]) to authenticated;

create or replace function public.send_group_message(gid uuid,message_body text,reply_mid uuid default null)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  mid uuid;
begin
  if uid is null then
    raise exception using errcode='42501',message='UNAUTHENTICATED';
  end if;
  if not public.is_group_member(gid,uid) then
    raise exception using errcode='42501',message='NOT_GROUP_MEMBER';
  end if;
  if char_length(trim(message_body))<1 or char_length(trim(message_body))>5000 then
    raise exception using errcode='22023',message='INVALID_MESSAGE';
  end if;
  if reply_mid is not null and not exists(
    select 1 from public.group_messages gm
    where gm.id=reply_mid and gm.group_id=gid
  ) then
    raise exception using errcode='22023',message='INVALID_REPLY';
  end if;
  insert into public.group_messages(group_id,sender_id,body,reply_to_id)
  values(gid,uid,trim(message_body),reply_mid)
  returning id into mid;
  update public.group_chats
  set last_message_at=now(),updated_at=now()
  where id=gid;
  return mid;
end;
$$;

revoke execute on function public.send_group_message(uuid,text,uuid) from public,anon;
grant execute on function public.send_group_message(uuid,text,uuid) to authenticated;

create or replace function public.leave_group_chat(gid uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  current_role text;
  next_owner uuid;
begin
  if uid is null then
    raise exception using errcode='42501',message='UNAUTHENTICATED';
  end if;
  select role into current_role
  from public.group_members
  where group_id=gid and user_id=uid and left_at is null;
  if current_role is null then
    raise exception using errcode='42501',message='NOT_GROUP_MEMBER';
  end if;
  if current_role='owner' then
    select user_id into next_owner
    from public.group_members
    where group_id=gid and user_id<>uid and left_at is null
    order by case when role='admin' then 0 else 1 end,joined_at
    limit 1;
    if next_owner is not null then
      update public.group_members set role='owner'
      where group_id=gid and user_id=next_owner;
    end if;
  end if;
  update public.group_members set left_at=now()
  where group_id=gid and user_id=uid and left_at is null;
  if not exists(select 1 from public.group_members where group_id=gid and left_at is null) then
    delete from public.group_chats where id=gid;
  end if;
end;
$$;

revoke execute on function public.leave_group_chat(uuid) from public,anon;
grant execute on function public.leave_group_chat(uuid) to authenticated;

do $group_realtime$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='group_messages'
  ) then
    alter publication supabase_realtime add table public.group_messages;
  end if;
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='group_members'
  ) then
    alter publication supabase_realtime add table public.group_members;
  end if;
end
$group_realtime$;
