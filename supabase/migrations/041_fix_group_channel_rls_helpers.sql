create or replace function public.current_user_is_group_member(gid uuid)
returns boolean
language sql
security definer
set search_path=public
stable
as $$
  select exists(
    select 1 from public.group_members gm
    where gm.group_id=gid
      and gm.user_id=auth.uid()
      and gm.left_at is null
  );
$$;

create or replace function public.current_user_is_group_admin(gid uuid)
returns boolean
language sql
security definer
set search_path=public
stable
as $$
  select exists(
    select 1 from public.group_members gm
    where gm.group_id=gid
      and gm.user_id=auth.uid()
      and gm.left_at is null
      and gm.role in ('owner','admin')
  );
$$;

create or replace function public.current_user_is_channel_member(cid uuid)
returns boolean
language sql
security definer
set search_path=public
stable
as $$
  select exists(
    select 1 from public.broadcast_channel_members bcm
    where bcm.channel_id=cid
      and bcm.user_id=auth.uid()
      and bcm.left_at is null
  );
$$;

create or replace function public.current_user_can_manage_channel(cid uuid)
returns boolean
language sql
security definer
set search_path=public
stable
as $$
  select exists(
    select 1 from public.broadcast_channel_members bcm
    where bcm.channel_id=cid
      and bcm.user_id=auth.uid()
      and bcm.left_at is null
      and bcm.role in ('owner','moderator')
  );
$$;

revoke execute on function public.current_user_is_group_member(uuid) from public,anon;
grant execute on function public.current_user_is_group_member(uuid) to authenticated;
revoke execute on function public.current_user_is_group_admin(uuid) from public,anon;
grant execute on function public.current_user_is_group_admin(uuid) to authenticated;
revoke execute on function public.current_user_is_channel_member(uuid) from public,anon;
grant execute on function public.current_user_is_channel_member(uuid) to authenticated;
revoke execute on function public.current_user_can_manage_channel(uuid) from public,anon;
grant execute on function public.current_user_can_manage_channel(uuid) to authenticated;

drop policy if exists group_chats_member_read on public.group_chats;
create policy group_chats_member_read
on public.group_chats for select to authenticated
using (public.current_user_is_group_member(id));

drop policy if exists group_members_member_read on public.group_members;
create policy group_members_member_read
on public.group_members for select to authenticated
using (public.current_user_is_group_member(group_id));

drop policy if exists group_messages_member_read on public.group_messages;
create policy group_messages_member_read
on public.group_messages for select to authenticated
using (public.current_user_is_group_member(group_id));

drop policy if exists group_messages_member_insert on public.group_messages;
create policy group_messages_member_insert
on public.group_messages for insert to authenticated
with check (
  sender_id=(select auth.uid())
  and public.current_user_is_group_member(group_id)
);

drop policy if exists group_messages_sender_update on public.group_messages;
create policy group_messages_sender_update
on public.group_messages for update to authenticated
using (
  sender_id=(select auth.uid())
  and public.current_user_is_group_member(group_id)
)
with check (
  sender_id=(select auth.uid())
  and public.current_user_is_group_member(group_id)
);

drop policy if exists group_reactions_member_read on public.group_message_reactions;
create policy group_reactions_member_read
on public.group_message_reactions for select to authenticated
using (
  exists(
    select 1 from public.group_messages gm
    where gm.id=group_message_reactions.message_id
      and public.current_user_is_group_member(gm.group_id)
  )
);

drop policy if exists group_reactions_member_write on public.group_message_reactions;
create policy group_reactions_member_write
on public.group_message_reactions for all to authenticated
using (
  user_id=(select auth.uid())
  and exists(
    select 1 from public.group_messages gm
    where gm.id=group_message_reactions.message_id
      and public.current_user_is_group_member(gm.group_id)
  )
)
with check (
  user_id=(select auth.uid())
  and exists(
    select 1 from public.group_messages gm
    where gm.id=group_message_reactions.message_id
      and public.current_user_is_group_member(gm.group_id)
  )
);

drop policy if exists broadcast_channels_read on public.broadcast_channels;
create policy broadcast_channels_read
on public.broadcast_channels for select to authenticated
using (
  is_public
  or owner_id=(select auth.uid())
  or public.current_user_is_channel_member(id)
);

drop policy if exists broadcast_members_read on public.broadcast_channel_members;
create policy broadcast_members_read
on public.broadcast_channel_members for select to authenticated
using (
  public.current_user_is_channel_member(channel_id)
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
      and (
        bc.is_public
        or public.current_user_is_channel_member(channel_id)
      )
  )
);

drop policy if exists broadcast_posts_manage on public.broadcast_channel_posts;
create policy broadcast_posts_manage
on public.broadcast_channel_posts for insert to authenticated
with check (
  author_id=(select auth.uid())
  and public.current_user_can_manage_channel(channel_id)
);

drop policy if exists broadcast_posts_author_update on public.broadcast_channel_posts;
create policy broadcast_posts_author_update
on public.broadcast_channel_posts for update to authenticated
using (
  author_id=(select auth.uid())
  and public.current_user_can_manage_channel(channel_id)
)
with check (
  author_id=(select auth.uid())
  and public.current_user_can_manage_channel(channel_id)
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
          and (
            bc.is_public
            or public.current_user_is_channel_member(p.channel_id)
          )
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
          and (
            bc.is_public
            or public.current_user_is_channel_member(p.channel_id)
          )
      )
  )
);

create or replace function public.send_group_message(
  gid uuid,
  message_body text,
  reply_mid uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid:=auth.uid(); mid uuid;
begin
  if uid is null then
    raise exception using errcode='42501',message='UNAUTHENTICATED';
  end if;
  if not public.current_user_is_group_member(gid) then
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

create or replace function public.publish_broadcast_post(
  cid uuid,
  post_body text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid:=auth.uid(); pid uuid;
begin
  if uid is null then
    raise exception using errcode='42501',message='UNAUTHENTICATED';
  end if;
  if not public.current_user_can_manage_channel(cid) then
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

drop function if exists public.is_group_member(uuid,uuid);
drop function if exists public.is_group_admin(uuid,uuid);
drop function if exists public.is_channel_member(uuid,uuid);
drop function if exists public.can_manage_channel(uuid,uuid);
drop function if exists private.is_group_member(uuid,uuid);
drop function if exists private.is_group_admin(uuid,uuid);
drop function if exists private.is_channel_member(uuid,uuid);
drop function if exists private.can_manage_channel(uuid,uuid);
