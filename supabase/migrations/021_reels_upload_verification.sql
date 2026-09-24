alter table public.profiles
  add column if not exists verified boolean not null default false,
  add column if not exists is_admin boolean not null default false;

alter table public.posts
  add column if not exists hashtags text[] not null default '{}'::text[],
  add column if not exists mentions text[] not null default '{}'::text[],
  add column if not exists location text not null default '';

alter table public.reels
  add column if not exists title text not null default '',
  add column if not exists hashtags text[] not null default '{}'::text[],
  add column if not exists mentions text[] not null default '{}'::text[],
  add column if not exists location text not null default '',
  add column if not exists cover_path text,
  add column if not exists media_width integer,
  add column if not exists media_height integer,
  add column if not exists view_count bigint not null default 0,
  add column if not exists share_count bigint not null default 0,
  add column if not exists save_count bigint not null default 0;

alter table public.stories
  add column if not exists caption text not null default '',
  add column if not exists hashtags text[] not null default '{}'::text[],
  add column if not exists mentions text[] not null default '{}'::text[],
  add column if not exists location text not null default '',
  add column if not exists cover_path text;

do $$
begin
  alter table public.reels
    add constraint reels_title_length check (char_length(title) <= 120),
    add constraint reels_location_length check (char_length(location) <= 160),
    add constraint reels_media_width_positive check (media_width is null or media_width > 0),
    add constraint reels_media_height_positive check (media_height is null or media_height > 0),
    add constraint reels_view_count_nonnegative check (view_count >= 0),
    add constraint reels_share_count_nonnegative check (share_count >= 0),
    add constraint reels_save_count_nonnegative check (save_count >= 0);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.posts
    add constraint posts_location_length check (char_length(location) <= 160);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.stories
    add constraint stories_caption_length check (char_length(caption) <= 2200),
    add constraint stories_location_length check (char_length(location) <= 160);
exception when duplicate_object then null;
end $$;

create table if not exists public.reel_views (
  reel_id uuid not null references public.reels(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  primary key (reel_id, viewer_id)
);

alter table public.reel_views enable row level security;

drop policy if exists reel_views_read_self on public.reel_views;
create policy reel_views_read_self
on public.reel_views for select to authenticated
using (viewer_id = (select auth.uid()));

drop policy if exists reel_views_insert_self on public.reel_views;
create policy reel_views_insert_self
on public.reel_views for insert to authenticated
with check (
  viewer_id = (select auth.uid())
  and exists (
    select 1 from public.reels r where r.id = reel_views.reel_id
  )
);

create index if not exists reel_views_viewer_idx
  on public.reel_views(viewer_id, first_viewed_at desc);

update public.reels r
set save_count = (
  select count(*) from public.saved_reels s where s.reel_id = r.id
);

update public.reels r
set share_count = (
  select count(*) from public.messages m where m.shared_reel_id = r.id
);

create or replace function public.bump_reel_view_count()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.reels
  set view_count = view_count + 1,
      updated_at = now()
  where id = new.reel_id;
  return new;
end;
$$;

drop trigger if exists reel_views_increment_count on public.reel_views;
create trigger reel_views_increment_count
after insert on public.reel_views
for each row execute function public.bump_reel_view_count();

create or replace function public.sync_reel_save_count()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare rid uuid;
begin
  rid := coalesce(new.reel_id, old.reel_id);

  update public.reels
  set save_count = (
        select count(*) from public.saved_reels s where s.reel_id = rid
      ),
      updated_at = now()
  where id = rid;

  return coalesce(new, old);
end;
$$;

drop trigger if exists saved_reels_sync_count on public.saved_reels;
create trigger saved_reels_sync_count
after insert or delete on public.saved_reels
for each row execute function public.sync_reel_save_count();

create or replace function public.bump_shared_reel_count()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.shared_reel_id is not null then
    update public.reels
    set share_count = share_count + 1,
        updated_at = now()
    where id = new.shared_reel_id;
  end if;
  return new;
end;
$$;

drop trigger if exists messages_increment_reel_share on public.messages;
create trigger messages_increment_reel_share
after insert on public.messages
for each row
when (new.shared_reel_id is not null)
execute function public.bump_shared_reel_count();

create or replace function public.record_reel_view(target_reel uuid)
returns bigint
language plpgsql
security invoker
set search_path=public
as $$
declare uid uuid := auth.uid();
declare total bigint;
begin
  if uid is null then
    raise exception using errcode='42501', message='AUTH_REQUIRED';
  end if;

  insert into public.reel_views(reel_id, viewer_id)
  values(target_reel, uid)
  on conflict (reel_id, viewer_id) do nothing;

  select view_count into total
  from public.reels
  where id = target_reel;

  if total is null then
    raise exception using errcode='P0002', message='REEL_NOT_FOUND';
  end if;

  return total;
end;
$$;

revoke all on function public.record_reel_view(uuid) from public, anon;
grant execute on function public.record_reel_view(uuid) to authenticated;

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid := auth.uid();
begin
  if new.verified is distinct from old.verified
     or new.is_admin is distinct from old.is_admin then
    if uid is not null
       and not exists (
         select 1 from public.profiles p
         where p.id = uid and p.is_admin = true
       ) then
      raise exception using errcode='42501', message='ADMIN_REQUIRED';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged_fields on public.profiles;
create trigger profiles_protect_privileged_fields
before update of verified, is_admin on public.profiles
for each row execute function public.protect_profile_privileged_fields();

create or replace function public.get_verification_candidates(search_term text default '')
returns table(
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  verified boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path=public
stable
as $$
declare uid uuid := auth.uid();
declare clean text := trim(coalesce(search_term, ''));
begin
  if uid is null
     or not exists (
       select 1 from public.profiles p
       where p.id = uid and p.is_admin = true
     ) then
    raise exception using errcode='42501', message='ADMIN_REQUIRED';
  end if;

  return query
  select p.id, p.username, p.display_name, p.avatar_url, p.verified, p.created_at
  from public.profiles p
  where p.deactivated_at is null
    and (
      clean = ''
      or p.username ilike '%' || replace(replace(clean, '%', ''), '_', '') || '%'
      or p.display_name ilike '%' || replace(replace(clean, '%', ''), '_', '') || '%'
    )
  order by p.verified desc, p.created_at asc
  limit 200;
end;
$$;

revoke all on function public.get_verification_candidates(text) from public, anon;
grant execute on function public.get_verification_candidates(text) to authenticated;

create or replace function public.set_profile_verification(
  target_user uuid,
  next_verified boolean
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null
     or not exists (
       select 1 from public.profiles p
       where p.id = uid and p.is_admin = true
     ) then
    raise exception using errcode='42501', message='ADMIN_REQUIRED';
  end if;

  update public.profiles
  set verified = next_verified,
      updated_at = now()
  where id = target_user;

  if not found then
    raise exception using errcode='P0002', message='PROFILE_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.set_profile_verification(uuid, boolean) from public, anon;
grant execute on function public.set_profile_verification(uuid, boolean) to authenticated;

create or replace function public.protect_reel_counters()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if current_user = 'authenticated'
     and (
       new.view_count is distinct from old.view_count
       or new.share_count is distinct from old.share_count
       or new.save_count is distinct from old.save_count
     ) then
    raise exception using errcode='42501', message='REEL_COUNTERS_READ_ONLY';
  end if;
  return new;
end;
$$;

drop trigger if exists reels_protect_counters on public.reels;
create trigger reels_protect_counters
before update of view_count, share_count, save_count on public.reels
for each row execute function public.protect_reel_counters();
