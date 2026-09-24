create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid := auth.uid();
declare actor_is_admin boolean := false;
begin
  if uid is not null then
    select coalesce(p.is_admin,false)
      into actor_is_admin
    from public.profiles p
    where p.id = uid;
  end if;

  if tg_op = 'INSERT' then
    if uid is not null and coalesce(new.is_admin,false) then
      raise exception using errcode='42501', message='PRIVILEGED_PROFILE_FIELDS';
    end if;
    return new;
  end if;

  if new.is_admin is distinct from old.is_admin then
    if uid is not null and not actor_is_admin then
      raise exception using errcode='42501', message='ADMIN_REQUIRED';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged_fields on public.profiles;
create trigger profiles_protect_privileged_fields
before insert or update of is_admin on public.profiles
for each row execute function public.protect_profile_privileged_fields();

do $$
begin
  if exists (
    select 1 from pg_publication where pubname='supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='reels'
  ) then
    execute 'alter publication supabase_realtime add table public.reels';
  end if;
end $$;

insert into public.reels (
  id,author_id,title,caption,media_path,media_type,cover_path,
  media_width,media_height,hashtags,mentions,location,
  view_count,share_count,save_count,created_at,updated_at
)
select
  p.id,p.author_id,'',p.caption,p.media_path,'video',p.cover_path,
  p.media_width,p.media_height,coalesce(p.hashtags,'{}'::text[]),
  coalesce(p.mentions,'{}'::text[]),coalesce(p.location,''),
  0,0,0,p.created_at,p.updated_at
from public.posts p
where p.media_type='video' and p.media_path is not null
on conflict (id) do nothing;

insert into public.reel_likes (reel_id,user_id,created_at)
select l.post_id,l.user_id,l.created_at
from public.likes l
join public.posts p on p.id=l.post_id
where p.media_type='video'
on conflict do nothing;

insert into public.reel_comments (id,reel_id,user_id,body,created_at)
select c.id,c.post_id,c.user_id,c.body,c.created_at
from public.comments c
join public.posts p on p.id=c.post_id
where p.media_type='video'
on conflict (id) do nothing;

insert into public.saved_reels (reel_id,user_id,created_at)
select s.post_id,s.user_id,s.created_at
from public.saved_posts s
join public.posts p on p.id=s.post_id
where p.media_type='video'
on conflict do nothing;

update public.messages m
set shared_reel_id=m.shared_post_id,
    shared_post_id=null
where m.shared_post_id in (
  select id from public.posts where media_type='video'
)
and m.shared_reel_id is null;

delete from public.posts where media_type='video';
