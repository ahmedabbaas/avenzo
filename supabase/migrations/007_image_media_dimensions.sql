alter table public.posts
  add column if not exists media_width integer,
  add column if not exists media_height integer;

alter table public.stories
  add column if not exists media_width integer,
  add column if not exists media_height integer;

do $media_dimensions$
begin
  alter table public.posts
    add constraint posts_media_width_positive
    check (media_width is null or media_width > 0);
exception when duplicate_object then null;
end
$media_dimensions$;

do $media_dimensions_height$
begin
  alter table public.posts
    add constraint posts_media_height_positive
    check (media_height is null or media_height > 0);
exception when duplicate_object then null;
end
$media_dimensions_height$;

do $story_media_dimensions$
begin
  alter table public.stories
    add constraint stories_media_width_positive
    check (media_width is null or media_width > 0);
exception when duplicate_object then null;
end
$story_media_dimensions$;

do $story_media_dimensions_height$
begin
  alter table public.stories
    add constraint stories_media_height_positive
    check (media_height is null or media_height > 0);
exception when duplicate_object then null;
end
$story_media_dimensions_height$;
