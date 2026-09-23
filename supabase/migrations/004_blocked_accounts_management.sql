create or replace function public.get_blocked_accounts()
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  blocked_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $get_blocked_accounts$
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    b.created_at as blocked_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$get_blocked_accounts$;

revoke execute on function public.get_blocked_accounts() from public, anon;
grant execute on function public.get_blocked_accounts() to authenticated;
