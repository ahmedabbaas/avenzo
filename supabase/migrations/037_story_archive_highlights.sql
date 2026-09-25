create table if not exists public.story_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  visibility text not null default 'followers'
    check (visibility in ('everyone','followers','close_friends')),
  cover_story_id uuid references public.stories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.story_highlight_items (
  highlight_id uuid not null references public.story_highlights(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  added_at timestamptz not null default now(),
  primary key (highlight_id,story_id)
);

create index if not exists story_highlights_user_created_idx
  on public.story_highlights(user_id,created_at desc);
create index if not exists story_highlight_items_order_idx
  on public.story_highlight_items(highlight_id,position,added_at);

alter table public.story_highlights enable row level security;
alter table public.story_highlight_items enable row level security;

drop policy if exists story_highlights_read on public.story_highlights;
create policy story_highlights_read on public.story_highlights
for select to authenticated
using (
  user_id=(select auth.uid())
  or (
    not public.users_blocked((select auth.uid()),user_id)
    and (
      not coalesce((select ps.account_private from public.privacy_settings ps where ps.user_id=story_highlights.user_id),false)
      or exists (select 1 from public.follows f where f.follower_id=(select auth.uid()) and f.following_id=story_highlights.user_id)
    )
    and (
      visibility='everyone'
      or (visibility='followers' and exists (select 1 from public.follows f where f.follower_id=(select auth.uid()) and f.following_id=story_highlights.user_id))
      or (visibility='close_friends' and exists (select 1 from public.close_friends cf where cf.user_id=story_highlights.user_id and cf.friend_id=(select auth.uid())))
    )
  )
);

drop policy if exists story_highlights_insert_self on public.story_highlights;
create policy story_highlights_insert_self on public.story_highlights
for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists story_highlights_update_self on public.story_highlights;
create policy story_highlights_update_self on public.story_highlights
for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists story_highlights_delete_self on public.story_highlights;
create policy story_highlights_delete_self on public.story_highlights
for delete to authenticated using (user_id=(select auth.uid()));

drop policy if exists story_highlight_items_read on public.story_highlight_items;
create policy story_highlight_items_read on public.story_highlight_items
for select to authenticated
using (exists (select 1 from public.story_highlights h where h.id=story_highlight_items.highlight_id));

drop policy if exists story_highlight_items_insert_owner on public.story_highlight_items;
create policy story_highlight_items_insert_owner on public.story_highlight_items
for insert to authenticated
with check (
  exists (select 1 from public.story_highlights h where h.id=story_highlight_items.highlight_id and h.user_id=(select auth.uid()))
  and exists (select 1 from public.stories s where s.id=story_highlight_items.story_id and s.author_id=(select auth.uid()))
);

drop policy if exists story_highlight_items_update_owner on public.story_highlight_items;
create policy story_highlight_items_update_owner on public.story_highlight_items
for update to authenticated
using (exists (select 1 from public.story_highlights h where h.id=story_highlight_items.highlight_id and h.user_id=(select auth.uid())))
with check (exists (select 1 from public.story_highlights h where h.id=story_highlight_items.highlight_id and h.user_id=(select auth.uid())));

drop policy if exists story_highlight_items_delete_owner on public.story_highlight_items;
create policy story_highlight_items_delete_owner on public.story_highlight_items
for delete to authenticated
using (exists (select 1 from public.story_highlights h where h.id=story_highlight_items.highlight_id and h.user_id=(select auth.uid())));

create or replace function public.get_own_story_archive()
returns table(story_id uuid,media_path text,media_type text,media_width integer,media_height integer,caption text,created_at timestamptz,expires_at timestamptz)
language sql security definer set search_path=public stable
as $own_story_archive$
  select s.id,s.media_path,s.media_type,s.media_width,s.media_height,s.caption,s.created_at,s.expires_at
  from public.stories s
  where s.author_id=auth.uid()
  order by s.created_at desc
  limit 500;
$own_story_archive$;

create or replace function public.get_profile_highlights(target_user uuid)
returns table(highlight_id uuid,highlight_title text,highlight_visibility text,highlight_created_at timestamptz,cover_story_id uuid,story_id uuid,media_path text,media_type text,media_width integer,media_height integer,caption text,story_created_at timestamptz,item_position integer)
language plpgsql security definer set search_path=public stable
as $profile_highlights$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception using errcode='42501',message='UNAUTHENTICATED'; end if;
  return query
  select h.id,h.title,h.visibility,h.created_at,h.cover_story_id,s.id,s.media_path,s.media_type,s.media_width,s.media_height,s.caption,s.created_at,hi.position
  from public.story_highlights h
  join public.story_highlight_items hi on hi.highlight_id=h.id
  join public.stories s on s.id=hi.story_id and s.author_id=h.user_id
  where h.user_id=target_user
    and (
      h.user_id=uid
      or (
        not public.users_blocked(uid,h.user_id)
        and (
          not coalesce((select ps.account_private from public.privacy_settings ps where ps.user_id=h.user_id),false)
          or exists (select 1 from public.follows f where f.follower_id=uid and f.following_id=h.user_id)
        )
        and (
          h.visibility='everyone'
          or (h.visibility='followers' and exists (select 1 from public.follows f where f.follower_id=uid and f.following_id=h.user_id))
          or (h.visibility='close_friends' and exists (select 1 from public.close_friends cf where cf.user_id=h.user_id and cf.friend_id=uid))
        )
      )
    )
  order by h.created_at asc,hi.position asc,hi.added_at asc;
end;
$profile_highlights$;

revoke execute on function public.get_own_story_archive() from public,anon;
revoke execute on function public.get_profile_highlights(uuid) from public,anon;
grant execute on function public.get_own_story_archive() to authenticated;
grant execute on function public.get_profile_highlights(uuid) to authenticated;
