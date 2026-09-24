alter table public.profiles
  add column if not exists website text not null default '',
  add column if not exists gender text,
  add column if not exists date_of_birth date;

do $profile_constraints$
begin
  alter table public.profiles
    add constraint profiles_website_length check (char_length(website) <= 2048);
exception when duplicate_object then null;
end
$profile_constraints$;

do $profile_gender_constraint$
begin
  alter table public.profiles
    add constraint profiles_gender_values
    check (gender is null or gender in ('male','female','other','prefer_not_to_say'));
exception when duplicate_object then null;
end
$profile_gender_constraint$;

do $profile_dob_constraint$
begin
  alter table public.profiles
    add constraint profiles_dob_not_future
    check (date_of_birth is null or date_of_birth <= current_date);
exception when duplicate_object then null;
end
$profile_dob_constraint$;

create table if not exists public.app_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'system'
    check (theme in ('light','dark','system')),
  language text not null default 'en'
    check (language in ('en','ur')),
  notify_likes boolean not null default true,
  notify_comments boolean not null default true,
  notify_followers boolean not null default true,
  notify_messages boolean not null default true,
  notify_mentions boolean not null default true,
  notify_stories boolean not null default true,
  notify_reels boolean not null default true,
  notify_other boolean not null default true,
  show_suggested_posts boolean not null default true,
  feed_autoplay_videos boolean not null default true,
  show_sensitive_content boolean not null default false,
  data_saving_mode boolean not null default false,
  media_autoplay_videos boolean not null default true,
  high_quality_uploads boolean not null default true,
  use_less_mobile_data boolean not null default false,
  reduce_animations boolean not null default false,
  larger_text boolean not null default false,
  high_contrast boolean not null default false,
  confirm_delete_content boolean not null default true,
  confirm_unfollow boolean not null default true,
  auto_save_settings boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.privacy_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  account_private boolean not null default false,
  who_can_follow text not null default 'everyone'
    check (who_can_follow in ('everyone','people_i_follow','no_one')),
  who_can_message text not null default 'everyone'
    check (who_can_message in ('everyone','people_i_follow','no_one')),
  who_can_comment text not null default 'everyone'
    check (who_can_comment in ('everyone','people_i_follow','no_one')),
  who_can_mention text not null default 'everyone'
    check (who_can_mention in ('everyone','people_i_follow','no_one')),
  who_can_tag text not null default 'everyone'
    check (who_can_tag in ('everyone','people_i_follow','no_one')),
  story_visibility text not null default 'followers'
    check (story_visibility in ('everyone','followers','close_friends','only_me')),
  updated_at timestamptz not null default now()
);

insert into public.app_settings(user_id)
select id from public.profiles
on conflict (user_id) do nothing;

insert into public.privacy_settings(user_id)
select id from public.profiles
on conflict (user_id) do nothing;

alter table public.app_settings enable row level security;
alter table public.privacy_settings enable row level security;

drop policy if exists app_settings_self on public.app_settings;
create policy app_settings_self on public.app_settings
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists privacy_settings_self on public.privacy_settings;
create policy privacy_settings_self on public.privacy_settings
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop trigger if exists app_settings_touch_updated_at on public.app_settings;
create trigger app_settings_touch_updated_at
before update on public.app_settings
for each row execute function public.touch_updated_at();

drop trigger if exists privacy_settings_touch_updated_at on public.privacy_settings;
create trigger privacy_settings_touch_updated_at
before update on public.privacy_settings
for each row execute function public.touch_updated_at();

drop trigger if exists prevent_profile_username_change on public.profiles;

create or replace function public.change_username(candidate text)
returns text
language plpgsql
security definer
set search_path = public
as $change_username$
declare
  uid uuid := auth.uid();
  next_username text := lower(trim(coalesce(candidate,'')));
  current_username text;
begin
  if uid is null then
    raise exception using errcode='42501', message='UNAUTHENTICATED';
  end if;
  if next_username !~ '^[a-z0-9._]{3,30}$' then
    raise exception using errcode='22023', message='INVALID_USERNAME';
  end if;

  select username into current_username from public.profiles where id = uid;
  if current_username is null then
    raise exception using errcode='P0002', message='PROFILE_NOT_FOUND';
  end if;
  if next_username = current_username then return current_username; end if;

  insert into public.username_claims(username, claimed_by)
  values (next_username, uid);

  update public.profiles set username = next_username where id = uid;
  return next_username;
exception
  when unique_violation then
    raise exception using errcode='23505', message='USERNAME_TAKEN';
end;
$change_username$;

revoke execute on function public.change_username(text) from public, anon;
grant execute on function public.change_username(text) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $handle_new_user_v2$
declare
  uname text := lower(trim(coalesce(new.raw_user_meta_data->>'username', '')));
  display_name text := trim(coalesce(new.raw_user_meta_data->>'display_name', ''));
begin
  if uname !~ '^[a-z0-9._]{3,30}$' then
    raise exception using errcode='22023', message='INVALID_USERNAME';
  end if;
  if char_length(display_name) < 1 or char_length(display_name) > 80 then
    raise exception using errcode='22023', message='INVALID_DISPLAY_NAME';
  end if;

  insert into public.username_claims(username, claimed_by) values (uname, new.id);
  insert into public.profiles(id, username, display_name) values (new.id, uname, display_name);
  insert into public.app_settings(user_id) values (new.id);
  insert into public.privacy_settings(user_id) values (new.id);
  return new;
exception
  when unique_violation then
    raise exception using errcode='23505', message='USERNAME_TAKEN';
end;
$handle_new_user_v2$;
