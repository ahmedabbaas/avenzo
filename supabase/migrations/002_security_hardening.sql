alter function public.touch_updated_at() set search_path = public;

revoke execute on function public.handle_new_block() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.notify_comment() from public, anon, authenticated;
revoke execute on function public.notify_follow() from public, anon, authenticated;
revoke execute on function public.notify_like() from public, anon, authenticated;
revoke execute on function public.notify_message() from public, anon, authenticated;
revoke execute on function public.prevent_username_change() from public, anon, authenticated;

revoke execute on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

revoke execute on function public.users_blocked(uuid, uuid) from public, anon;
grant execute on function public.users_blocked(uuid, uuid) to authenticated;

create index if not exists comments_user_idx on public.comments(user_id);
create index if not exists likes_user_idx on public.likes(user_id);
create index if not exists notifications_actor_idx on public.notifications(actor_id);
create index if not exists reports_post_idx on public.reports(reported_post_id);
create index if not exists reports_reported_user_idx on public.reports(reported_user_id);
create index if not exists saved_posts_user_idx on public.saved_posts(user_id);
