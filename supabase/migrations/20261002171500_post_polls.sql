create table if not exists public.post_polls (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.posts(id) on delete cascade,
  question text not null check (char_length(trim(question)) between 1 and 180),
  multiple_choice boolean not null default false,
  closes_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.post_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.post_polls(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 80),
  position integer not null check (position between 0 and 5),
  created_at timestamptz not null default now(),
  unique (poll_id, position),
  unique (id, poll_id)
);

create table if not exists public.post_poll_votes (
  poll_id uuid not null references public.post_polls(id) on delete cascade,
  option_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id),
  foreign key (option_id, poll_id)
    references public.post_poll_options(id, poll_id)
    on delete cascade
);

create index if not exists post_poll_options_poll_id_idx
  on public.post_poll_options(poll_id, position);
create index if not exists post_poll_votes_option_id_idx
  on public.post_poll_votes(option_id);
create index if not exists post_poll_votes_option_poll_idx
  on public.post_poll_votes(option_id, poll_id);
create index if not exists post_poll_votes_user_id_idx
  on public.post_poll_votes(user_id);

alter table public.post_polls enable row level security;
alter table public.post_poll_options enable row level security;
alter table public.post_poll_votes enable row level security;

grant select, insert, update, delete on public.post_polls to authenticated;
grant select, insert, update, delete on public.post_poll_options to authenticated;
grant select, insert, update, delete on public.post_poll_votes to authenticated;

drop policy if exists post_polls_read_visible_posts on public.post_polls;
create policy post_polls_read_visible_posts on public.post_polls
for select to authenticated
using (exists (select 1 from public.posts p where p.id = post_polls.post_id));

drop policy if exists post_polls_author_insert on public.post_polls;
create policy post_polls_author_insert on public.post_polls
for insert to authenticated
with check (exists (
  select 1 from public.posts p
  where p.id = post_polls.post_id and p.author_id = (select auth.uid())
));

drop policy if exists post_polls_author_update on public.post_polls;
create policy post_polls_author_update on public.post_polls
for update to authenticated
using (exists (
  select 1 from public.posts p
  where p.id = post_polls.post_id and p.author_id = (select auth.uid())
))
with check (exists (
  select 1 from public.posts p
  where p.id = post_polls.post_id and p.author_id = (select auth.uid())
));

drop policy if exists post_polls_author_delete on public.post_polls;
create policy post_polls_author_delete on public.post_polls
for delete to authenticated
using (exists (
  select 1 from public.posts p
  where p.id = post_polls.post_id and p.author_id = (select auth.uid())
));

drop policy if exists post_poll_options_read_visible_poll on public.post_poll_options;
create policy post_poll_options_read_visible_poll on public.post_poll_options
for select to authenticated
using (exists (select 1 from public.post_polls poll where poll.id = post_poll_options.poll_id));

drop policy if exists post_poll_options_author_insert on public.post_poll_options;
create policy post_poll_options_author_insert on public.post_poll_options
for insert to authenticated
with check (exists (
  select 1 from public.post_polls poll
  join public.posts p on p.id = poll.post_id
  where poll.id = post_poll_options.poll_id and p.author_id = (select auth.uid())
));

drop policy if exists post_poll_options_author_update on public.post_poll_options;
create policy post_poll_options_author_update on public.post_poll_options
for update to authenticated
using (exists (
  select 1 from public.post_polls poll
  join public.posts p on p.id = poll.post_id
  where poll.id = post_poll_options.poll_id and p.author_id = (select auth.uid())
))
with check (exists (
  select 1 from public.post_polls poll
  join public.posts p on p.id = poll.post_id
  where poll.id = post_poll_options.poll_id and p.author_id = (select auth.uid())
));

drop policy if exists post_poll_options_author_delete on public.post_poll_options;
create policy post_poll_options_author_delete on public.post_poll_options
for delete to authenticated
using (exists (
  select 1 from public.post_polls poll
  join public.posts p on p.id = poll.post_id
  where poll.id = post_poll_options.poll_id and p.author_id = (select auth.uid())
));

drop policy if exists post_poll_votes_read_visible_poll on public.post_poll_votes;
create policy post_poll_votes_read_visible_poll on public.post_poll_votes
for select to authenticated
using (exists (select 1 from public.post_polls poll where poll.id = post_poll_votes.poll_id));

drop policy if exists post_poll_votes_self_insert on public.post_poll_votes;
create policy post_poll_votes_self_insert on public.post_poll_votes
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.post_polls poll
    where poll.id = post_poll_votes.poll_id
      and (poll.closes_at is null or poll.closes_at > now())
  )
);

drop policy if exists post_poll_votes_self_update on public.post_poll_votes;
create policy post_poll_votes_self_update on public.post_poll_votes
for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.post_polls poll
    where poll.id = post_poll_votes.poll_id
      and (poll.closes_at is null or poll.closes_at > now())
  )
);

drop policy if exists post_poll_votes_self_delete on public.post_poll_votes;
create policy post_poll_votes_self_delete on public.post_poll_votes
for delete to authenticated
using (user_id = (select auth.uid()));
