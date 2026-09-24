alter table public.profiles
  add column if not exists deactivated_at timestamptz;

create or replace function public.deactivate_account()
returns void
language plpgsql
security definer
set search_path = public
as $deactivate_account$
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='UNAUTHENTICATED';
  end if;

  update public.profiles
  set deactivated_at = now()
  where id = auth.uid();
end;
$deactivate_account$;

revoke execute on function public.deactivate_account() from public, anon;
grant execute on function public.deactivate_account() to authenticated;
