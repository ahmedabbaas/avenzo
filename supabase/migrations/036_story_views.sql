create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id,viewer_id)
);

create index if not exists story_views_viewer_idx
  on public.story_views(viewer_id,viewed_at desc);

alter table public.story_views enable row level security;

drop policy if exists story_views_read on public.story_views;
create policy story_views_read
on public.story_views
for select to authenticated
using (
  viewer_id=(select auth.uid())
  or exists (
    select 1
    from public.stories s
    where s.id=story_views.story_id
      and s.author_id=(select auth.uid())
  )
);

drop policy if exists story_views_insert_self on public.story_views;
create policy story_views_insert_self
on public.story_views
for insert to authenticated
with check (
  viewer_id=(select auth.uid())
  and exists (
    select 1
    from public.stories s
    where s.id=story_views.story_id
  )
);

drop policy if exists story_views_update_self on public.story_views;
create policy story_views_update_self
on public.story_views
for update to authenticated
using (viewer_id=(select auth.uid()))
with check (viewer_id=(select auth.uid()));

do $story_views_realtime$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='story_views'
  ) then
    alter publication supabase_realtime add table public.story_views;
  end if;
end
$story_views_realtime$;
