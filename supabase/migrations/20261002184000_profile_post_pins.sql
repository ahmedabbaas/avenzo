alter table public.posts
  add column if not exists pinned_at timestamptz;

create index if not exists posts_author_pinned_idx
  on public.posts(author_id, pinned_at desc)
  where pinned_at is not null;

create or replace function public.enforce_post_pin_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  pinned_count integer;
begin
  if new.pinned_at is not null
     and (tg_op = 'INSERT' or old.pinned_at is distinct from new.pinned_at) then
    select count(*)
      into pinned_count
    from public.posts
    where author_id = new.author_id
      and pinned_at is not null
      and id <> new.id;

    if pinned_count >= 3 then
      raise exception 'POST_PIN_LIMIT_REACHED';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_post_pin_limit_trigger on public.posts;
create trigger enforce_post_pin_limit_trigger
before insert or update of pinned_at on public.posts
for each row
execute function public.enforce_post_pin_limit();
