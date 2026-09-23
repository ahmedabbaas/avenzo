create table if not exists public.auth_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  hits integer not null default 0 check (hits >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists auth_rate_limits_updated_idx
  on public.auth_rate_limits(updated_at);

alter table public.auth_rate_limits enable row level security;

revoke all on table public.auth_rate_limits from public, anon, authenticated;

create or replace function public.consume_auth_rate_limit(
  candidate_key text,
  max_hits integer,
  window_seconds integer
)
returns table (
  allowed boolean,
  retry_after integer
)
language plpgsql
security definer
set search_path = public
as $consume_auth_rate_limit$
declare
  current_row public.auth_rate_limits%rowtype;
  now_value timestamptz := now();
begin
  if candidate_key is null
     or char_length(candidate_key) < 32
     or char_length(candidate_key) > 128
     or max_hits < 1
     or max_hits > 500
     or window_seconds < 1
     or window_seconds > 86400 then
    raise exception 'invalid rate limit arguments';
  end if;

  insert into public.auth_rate_limits (
    key_hash,
    window_started_at,
    hits,
    updated_at
  )
  values (
    candidate_key,
    now_value,
    1,
    now_value
  )
  on conflict (key_hash) do update
  set
    window_started_at = case
      when public.auth_rate_limits.window_started_at
        <= now_value - make_interval(secs => window_seconds)
      then now_value
      else public.auth_rate_limits.window_started_at
    end,
    hits = case
      when public.auth_rate_limits.window_started_at
        <= now_value - make_interval(secs => window_seconds)
      then 1
      else public.auth_rate_limits.hits + 1
    end,
    updated_at = now_value
  returning * into current_row;

  allowed := current_row.hits <= max_hits;

  retry_after := case
    when allowed then 0
    else greatest(
      1,
      ceil(
        extract(
          epoch from (
            current_row.window_started_at
            + make_interval(secs => window_seconds)
            - now_value
          )
        )
      )::integer
    )
  end;

  return next;
end;
$consume_auth_rate_limit$;

revoke execute on function public.consume_auth_rate_limit(text, integer, integer)
  from public;
grant execute on function public.consume_auth_rate_limit(text, integer, integer)
  to anon, authenticated;
