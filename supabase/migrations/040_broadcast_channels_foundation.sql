create table if not exists public.broadcast_channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 280),
  avatar_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_post_at timestamptz
);

create table if not exists public.broadcast_channel_members (
  channel_id uuid not null references public.broadcast_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner','moderator','member')),
  muted boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key(channel_id,user_id)
);

create table if not exists public.broadcast_channel_posts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.broadcast_channels(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.broadcast_channel_reactions (
  post_id uuid not null references public.broadcast_channel_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);

create index if not exists broadcast_channels_owner_idx
  on public.broadcast_channels(owner_id,created_at desc);
create index if not exists broadcast_channel_members_user_idx
  on public.broadcast_channel_members(user_id,channel_id)
  where left_at is null;
create index if not exists broadcast_channel_posts_channel_idx
  on public.broadcast_channel_posts(channel_id,created_at);

alter table public.broadcast_channels enable row level security;
alter table public.broadcast_channel_members enable row level security;
alter table public.broadcast_channel_posts enable row level security;
alter table public.broadcast_channel_reactions enable row level security;

create or replace function public.is_channel_member(cid uuid, uid uuid)
returns boolean language sql security definer set search_path=public stable
as $$
  select exists(
    select 1 from public.broadcast_channel_members bcm
    where bcm.channel_id=cid and bcm.user_id=uid and bcm.left_at is null
  );
$$;

create or replace function public.can_manage_channel(cid uuid, uid uuid)
returns boolean language sql security definer set search_path=public stable
as $$
  select exists(
    select 1 from public.broadcast_channel_members bcm
    where bcm.channel_id=cid and bcm.user_id=uid and bcm.left_at is null
      and bcm.role in ('owner','moderator')
  );
$$;

revoke execute on function public.is_channel_member(uuid,uuid) from public,anon;
grant execute on function public.is_channel_member(uuid,uuid) to authenticated;
revoke execute on function public.can_manage_channel(uuid,uuid) from public,anon;
grant execute on function public.can_manage_channel(uuid,uuid) to authenticated;

drop policy if exists broadcast_channels_read on public.broadcast_channels;
create policy broadcast_channels_read
on public.broadcast_channels for select to authenticated
using (
  is_public
  or owner_id=(select auth.uid())
  or public.is_channel_member(id,(select auth.uid()))
);

drop policy if exists broadcast_members_read on public.broadcast_channel_members;
create policy broadcast_members_read
on public.broadcast_channel_members for select to authenticated
using (
  public.is_channel_member(channel_id,(select auth.uid()))
  or exists(
    select 1 from public.broadcast_channels bc
    where bc.id=channel_id and bc.is_public
  )
);

drop policy if exists broadcast_posts_read on public.broadcast_channel_posts;
create policy broadcast_posts_read
on public.broadcast_channel_posts for select to authenticated
using (
  exists(
    select 1 from public.broadcast_channels bc
    where bc.id=channel_id
      and (bc.is_public or public.is_channel_member(channel_id,(select auth.uid())))
  )
);

drop policy if exists broadcast_posts_manage on public.broadcast_channel_posts;
create policy broadcast_posts_manage
on public.broadcast_channel_posts for insert to authenticated
with check (
  author_id=(select auth.uid())
  and public.can_manage_channel(channel_id,(select auth.uid()))
);

drop policy if exists broadcast_posts_author_update on public.broadcast_channel_posts;
create policy broadcast_posts_author_update
on public.broadcast_channel_posts for update to authenticated
using (
  author_id=(select auth.uid())
  and public.can_manage_channel(channel_id,(select auth.uid()))
)
with check (
  author_id=(select auth.uid())
  and public.can_manage_channel(channel_id,(select auth.uid()))
);

drop policy if exists broadcast_reactions_read on public.broadcast_channel_reactions;
create policy broadcast_reactions_read
on public.broadcast_channel_reactions for select to authenticated
using (
  exists(
    select 1 from public.broadcast_channel_posts p
    where p.id=post_id
      and exists(
        select 1 from public.broadcast_channels bc
        where bc.id=p.channel_id
          and (bc.is_public or public.is_channel_member(p.channel_id,(select auth.uid())))
      )
  )
);

drop policy if exists broadcast_reactions_write on public.broadcast_channel_reactions;
create policy broadcast_reactions_write
on public.broadcast_channel_reactions for all to authenticated
using (user_id=(select auth.uid()))
with check (
  user_id=(select auth.uid())
  and exists(
    select 1 from public.broadcast_channel_posts p
    where p.id=post_id
      and exists(
        select 1 from public.broadcast_channels bc
        where bc.id=p.channel_id
          and (bc.is_public or public.is_channel_member(p.channel_id,(select auth.uid())))
      )
  )
);

create or replace function public.create_broadcast_channel(
  channel_title text,
  channel_description text default ''
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid:=auth.uid(); cid uuid;
begin
  if uid is null then raise exception using errcode='42501',message='UNAUTHENTICATED'; end if;
  if char_length(trim(channel_title))<1 or char_length(trim(channel_title))>80 then
    raise exception using errcode='22023',message='INVALID_CHANNEL_TITLE';
  end if;
  if char_length(coalesce(channel_description,''))>280 then
    raise exception using errcode='22023',message='INVALID_CHANNEL_DESCRIPTION';
  end if;

  insert into public.broadcast_channels(owner_id,title,description)
  values(uid,trim(channel_title),trim(coalesce(channel_description,'')))
  returning id into cid;

  insert into public.broadcast_channel_members(channel_id,user_id,role)
  values(cid,uid,'owner');

  return cid;
end;
$$;

revoke execute on function public.create_broadcast_channel(text,text) from public,anon;
grant execute on function public.create_broadcast_channel(text,text) to authenticated;

create or replace function public.join_broadcast_channel(cid uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid:=auth.uid(); is_public_channel boolean;
begin
  if uid is null then raise exception using errcode='42501',message='UNAUTHENTICATED'; end if;
  select is_public into is_public_channel from public.broadcast_channels where id=cid;
  if is_public_channel is null then raise exception using errcode='P0002',message='CHANNEL_NOT_FOUND'; end if;
  if not is_public_channel then raise exception using errcode='42501',message='CHANNEL_PRIVATE'; end if;

  insert into public.broadcast_channel_members(channel_id,user_id,role,left_at)
  values(cid,uid,'member',null)
  on conflict(channel_id,user_id)
  do update set left_at=null,joined_at=now();
end;
$$;

revoke execute on function public.join_broadcast_channel(uuid) from public,anon;
grant execute on function public.join_broadcast_channel(uuid) to authenticated;

create or replace function public.leave_broadcast_channel(cid uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid:=auth.uid(); role_now text;
begin
  if uid is null then raise exception using errcode='42501',message='UNAUTHENTICATED'; end if;

  select role into role_now
  from public.broadcast_channel_members
  where channel_id=cid and user_id=uid and left_at is null;

  if role_now='owner' then
    raise exception using errcode='42501',message='OWNER_CANNOT_LEAVE';
  end if;

  update public.broadcast_channel_members
  set left_at=now()
  where channel_id=cid and user_id=uid and left_at is null;
end;
$$;

revoke execute on function public.leave_broadcast_channel(uuid) from public,anon;
grant execute on function public.leave_broadcast_channel(uuid) to authenticated;

create or replace function public.publish_broadcast_post(cid uuid,post_body text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid:=auth.uid(); pid uuid;
begin
  if uid is null then raise exception using errcode='42501',message='UNAUTHENTICATED'; end if;
  if not public.can_manage_channel(cid,uid) then
    raise exception using errcode='42501',message='NOT_CHANNEL_MANAGER';
  end if;
  if char_length(trim(post_body))<1 or char_length(trim(post_body))>5000 then
    raise exception using errcode='22023',message='INVALID_CHANNEL_POST';
  end if;

  insert into public.broadcast_channel_posts(channel_id,author_id,body)
  values(cid,uid,trim(post_body))
  returning id into pid;

  update public.broadcast_channels
  set last_post_at=now(),updated_at=now()
  where id=cid;

  return pid;
end;
$$;

revoke execute on function public.publish_broadcast_post(uuid,text) from public,anon;
grant execute on function public.publish_broadcast_post(uuid,text) to authenticated;

do $broadcast_realtime$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='broadcast_channel_posts'
  ) then
    alter publication supabase_realtime add table public.broadcast_channel_posts;
  end if;
end
$broadcast_realtime$;
