-- Allow the configured AVENZO owner to manage only the brand settings row via their authenticated session.
alter table public.admin_settings enable row level security;
revoke all on public.admin_settings from anon;
grant select, insert, update on public.admin_settings to authenticated;

drop policy if exists avenzo_admin_settings_select on public.admin_settings;
drop policy if exists avenzo_admin_settings_insert on public.admin_settings;
drop policy if exists avenzo_admin_settings_update on public.admin_settings;

create policy avenzo_admin_settings_select
  on public.admin_settings for select to authenticated
  using ((auth.jwt()->>'email') = 'tgahmed110@gmail.com' and key = 'brand');

create policy avenzo_admin_settings_insert
  on public.admin_settings for insert to authenticated
  with check ((auth.jwt()->>'email') = 'tgahmed110@gmail.com' and key = 'brand');

create policy avenzo_admin_settings_update
  on public.admin_settings for update to authenticated
  using ((auth.jwt()->>'email') = 'tgahmed110@gmail.com' and key = 'brand')
  with check ((auth.jwt()->>'email') = 'tgahmed110@gmail.com' and key = 'brand');
