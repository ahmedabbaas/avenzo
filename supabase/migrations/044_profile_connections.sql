-- Dedicated, paginated follower/following reads and owner-controlled removal.

create index if not exists follow_requests_target_status_idx
  on public.follow_requests (target_id, status, created_at desc);

create or replace function public.get_profile_connections(
  target_user uuid,
  connection_type text,
  search_term text default '',
  page_limit integer default 24,
  page_offset integer default 0
)
returns table (
  profile_id uuid,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  verified boolean,
  followed_at timestamptz,
  viewer_state text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id as profile_id,
    p.username,
    p.display_name,
    p.bio,
    p.avatar_url,
    p.verified,
    f.created_at as followed_at,
    case
      when p.id = auth.uid() then 'self'
      when exists (
        select 1
        from public.follows mine
        where mine.follower_id = auth.uid()
          and mine.following_id = p.id
      ) then 'following'
      when exists (
        select 1
        from public.follow_requests pending
        where pending.requester_id = auth.uid()
          and pending.target_id = p.id
          and pending.status = 'pending'
      ) then 'requested'
      else 'none'
    end as viewer_state,
    count(*) over() as total_count
  from public.follows f
  join public.profiles p
    on p.id = case
      when connection_type = 'followers' then f.follower_id
      else f.following_id
    end
  where auth.uid() is not null
    and connection_type in ('followers', 'following')
    and (
      (connection_type = 'followers' and f.following_id = target_user)
      or
      (connection_type = 'following' and f.follower_id = target_user)
    )
    and p.deactivated_at is null
    and not public.users_blocked(auth.uid(), p.id)
    and (
      btrim(coalesce(search_term, '')) = ''
      or p.username ilike '%' || btrim(search_term) || '%'
      or p.display_name ilike '%' || btrim(search_term) || '%'
    )
  order by f.created_at desc, p.username asc
  limit least(greatest(page_limit, 1), 50)
  offset greatest(page_offset, 0);
$$;

revoke all on function public.get_profile_connections(uuid, text, text, integer, integer)
  from public, anon;
grant execute on function public.get_profile_connections(uuid, text, text, integer, integer)
  to authenticated;

create or replace function public.remove_follower(target_follower uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_rows integer := 0;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if target_follower is null or target_follower = auth.uid() then
    return false;
  end if;

  delete from public.follows
  where follower_id = target_follower
    and following_id = auth.uid();

  get diagnostics deleted_rows = row_count;
  return deleted_rows > 0;
end;
$$;

revoke all on function public.remove_follower(uuid) from public, anon;
grant execute on function public.remove_follower(uuid) to authenticated;
