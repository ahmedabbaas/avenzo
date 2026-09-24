-- Fix direct-message RLS recursion introduced by advanced DM policies.

drop policy if exists hidden_self on public.message_hidden;

create policy hidden_self
on public.message_hidden
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function public.can_send_message(cid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $can_send_message$
  select
    public.is_conversation_participant(cid, uid)
    and not public.users_blocked(
      uid,
      (
        select cp.user_id
        from public.conversation_participants cp
        where cp.conversation_id = cid
          and cp.user_id <> uid
          and cp.left_at is null
        limit 1
      )
    )
    and coalesce(
      (
        select
          mr.status = 'accepted'
          or (mr.status = 'pending' and mr.requester_id = uid)
        from public.message_requests mr
        where mr.conversation_id = cid
      ),
      true
    );
$can_send_message$;

revoke execute on function public.can_send_message(uuid, uuid)
from public, anon;
grant execute on function public.can_send_message(uuid, uuid)
to authenticated;
