-- Private AVENZO admin settings. Access only through server API after owner email verification.
create table if not exists public.admin_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.admin_settings enable row level security;
revoke all on public.admin_settings from anon, authenticated;
-- No client-facing policies are intentionally created. Server API uses the service-role key.
