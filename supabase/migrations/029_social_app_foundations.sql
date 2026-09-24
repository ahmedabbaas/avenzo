alter table public.profiles
  add column if not exists is_private boolean not null default false;

create table if not exists public.close_friends (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  constraint close_friends_not_self check (user_id <> friend_id)
);

create table if not exists public.follow_requests (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester_id, target_id),
  constraint follow_requests_not_self check (requester_id <> target_id)
);

create table if not exists public.notes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 80),
  audience text not null default 'followers'
    check (audience in ('everyone','followers','close_friends')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists notes_expires_at_idx
  on public.notes(expires_at);

create table if not exists public.saved_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists saved_collections_user_name_idx
  on public.saved_collections(user_id, lower(name));

create table if not exists public.saved_collection_items (
  collection_id uuid not null references public.saved_collections(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  reel_id uuid references public.reels(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_collection_items_exactly_one
    check ((post_id is not null)::int + (reel_id is not null)::int = 1)
);

create unique index if not exists saved_collection_post_unique
  on public.saved_collection_items(collection_id, post_id)
  where post_id is not null;

create unique index if not exists saved_collection_reel_unique
  on public.saved_collection_items(collection_id, reel_id)
  where reel_id is not null;

alter table public.close_friends enable row level security;
alter table public.follow_requests enable row level security;
alter table public.notes enable row level security;
alter table public.saved_collections enable row level security;
alter table public.saved_collection_items enable row level security;

drop policy if exists close_friends_owner_all on public.close_friends;
create policy close_friends_owner_all
on public.close_friends
for all to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and friend_id <> (select auth.uid())
);

drop policy if exists follow_requests_visible_parties on public.follow_requests;
create policy follow_requests_visible_parties
on public.follow_requests
for select to authenticated
using (
  requester_id = (select auth.uid())
  or target_id = (select auth.uid())
);

drop policy if exists follow_requests_requester_insert on public.follow_requests;
create policy follow_requests_requester_insert
on public.follow_requests
for insert to authenticated
with check (
  requester_id = (select auth.uid())
  and target_id <> (select auth.uid())
);

drop policy if exists follow_requests_parties_update on public.follow_requests;
create policy follow_requests_parties_update
on public.follow_requests
for update to authenticated
using (
  requester_id = (select auth.uid())
  or target_id = (select auth.uid())
)
with check (
  requester_id = (select auth.uid())
  or target_id = (select auth.uid())
);

drop policy if exists notes_owner_write on public.notes;
create policy notes_owner_write
on public.notes
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists notes_visible_read on public.notes;
create policy notes_visible_read
on public.notes
for select to authenticated
using (
  expires_at > now()
  and (
    user_id = (select auth.uid())
    or audience = 'everyone'
    or (
      audience = 'followers'
      and exists (
        select 1
        from public.follows f
        where f.follower_id = (select auth.uid())
          and f.following_id = notes.user_id
      )
    )
    or (
      audience = 'close_friends'
      and exists (
        select 1
        from public.close_friends cf
        where cf.user_id = notes.user_id
          and cf.friend_id = (select auth.uid())
      )
    )
  )
);

drop policy if exists saved_collections_owner_all on public.saved_collections;
create policy saved_collections_owner_all
on public.saved_collections
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists saved_collection_items_owner_all on public.saved_collection_items;
create policy saved_collection_items_owner_all
on public.saved_collection_items
for all to authenticated
using (
  exists (
    select 1
    from public.saved_collections c
    where c.id = saved_collection_items.collection_id
      and c.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.saved_collections c
    where c.id = saved_collection_items.collection_id
      and c.user_id = (select auth.uid())
  )
);

do $notes_realtime$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='notes'
  ) then
    alter publication supabase_realtime add table public.notes;
  end if;
end
$notes_realtime$;
