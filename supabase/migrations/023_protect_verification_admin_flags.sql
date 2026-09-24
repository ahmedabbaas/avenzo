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
    if uid is not null and (coalesce(new.verified,false) or coalesce(new.is_admin,false)) then
      raise exception using errcode='42501', message='PRIVILEGED_PROFILE_FIELDS';
    end if;
    return new;
  end if;

  if new.verified is distinct from old.verified
     or new.is_admin is distinct from old.is_admin then
    if uid is not null and not actor_is_admin then
      raise exception using errcode='42501', message='ADMIN_REQUIRED';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged_fields on public.profiles;
create trigger profiles_protect_privileged_fields
before insert or update of verified, is_admin on public.profiles
for each row execute function public.protect_profile_privileged_fields();
