-- AVENZO notification coverage for comment replies and comment likes.
-- Keeps notification preferences aligned with the activity type being generated.

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'follow',
      'follow_request',
      'follow_request_accepted',
      'like',
      'comment',
      'reply',
      'comment_like',
      'message',
      'message_request',
      'message_reply',
      'message_reaction',
      'collab_invite',
      'collab_accepted'
    )
  );

create or replace function public.notification_enabled(
  recipient uuid,
  notification_type text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $notification_enabled$
  select coalesce(
    (
      select case
        when notification_type in ('like', 'comment_like') then notify_likes
        when notification_type in ('comment', 'reply') then notify_comments
        when notification_type in (
          'follow',
          'follow_request',
          'follow_request_accepted'
        ) then notify_followers
        when notification_type in (
          'message',
          'message_request',
          'message_reply',
          'message_reaction'
        ) then notify_messages
        else notify_other
      end
      from public.app_settings
      where user_id = recipient
    ),
    true
  );
$notification_enabled$;

revoke execute on function public.notification_enabled(uuid,text)
from public, anon, authenticated;

create or replace function public.notify_comment_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $notify_comment_like$
declare
  comment_author uuid;
  target_post uuid;
begin
  select c.user_id, c.post_id
    into comment_author, target_post
  from public.comments c
  where c.id = new.comment_id;

  if comment_author is not null
     and target_post is not null
     and comment_author <> new.user_id
     and public.notification_enabled(comment_author, 'comment_like') then
    insert into public.notifications(
      recipient_id,
      actor_id,
      type,
      entity_id
    )
    values(
      comment_author,
      new.user_id,
      'comment_like',
      target_post
    );
  end if;

  return new;
end;
$notify_comment_like$;

revoke execute on function public.notify_comment_like()
from public, anon, authenticated;

drop trigger if exists on_comment_like_notify on public.comment_likes;
create trigger on_comment_like_notify
after insert on public.comment_likes
for each row execute function public.notify_comment_like();
