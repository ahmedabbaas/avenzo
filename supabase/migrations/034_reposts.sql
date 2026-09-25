create table if not exists public.reposts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  reel_id uuid references public.reels(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 120),
  created_at timestamptz not null default now(),
  constraint reposts_exactly_one_content
    check ((post_id is not null)::int + (reel_id is not null)::int = 1)
);

create unique index if not exists reposts_user_post_unique
  on public.reposts(user_id, post_id)
  where post_id is not null;
create unique index if not exists reposts_user_reel_unique
  on public.reposts(user_id, reel_id)
  where reel_id is not null;
create index if not exists reposts_user_created_idx
  on public.reposts(user_id, created_at desc);
create index if not exists reposts_post_idx
  on public.reposts(post_id) where post_id is not null;
create index if not exists reposts_reel_idx
  on public.reposts(reel_id) where reel_id is not null;

alter table public.reposts enable row level security;

drop policy if exists reposts_read_visible on public.reposts;
create policy reposts_read_visible
on public.reposts for select to authenticated
using (
  user_id=(select auth.uid())
  or (
    not public.users_blocked((select auth.uid()),user_id)
    and (
      not coalesce(
        (select ps.account_private
         from public.privacy_settings ps
         where ps.user_id=reposts.user_id),
        false
      )
      or exists (
        select 1 from public.follows f
        where f.follower_id=(select auth.uid())
          and f.following_id=reposts.user_id
      )
    )
    and (
      (post_id is not null and exists (
        select 1 from public.posts p where p.id=reposts.post_id
      ))
      or
      (reel_id is not null and exists (
        select 1 from public.reels r where r.id=reposts.reel_id
      ))
    )
  )
);

drop policy if exists reposts_insert_self on public.reposts;
create policy reposts_insert_self
on public.reposts for insert to authenticated
with check (
  user_id=(select auth.uid())
  and (
    (post_id is not null and exists (
      select 1 from public.posts p where p.id=reposts.post_id
    ))
    or
    (reel_id is not null and exists (
      select 1 from public.reels r where r.id=reposts.reel_id
    ))
  )
);

drop policy if exists reposts_update_self on public.reposts;
create policy reposts_update_self
on public.reposts for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));

drop policy if exists reposts_delete_self on public.reposts;
create policy reposts_delete_self
on public.reposts for delete to authenticated
using (user_id=(select auth.uid()));
