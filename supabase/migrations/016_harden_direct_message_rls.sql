drop policy if exists messages_read_participant on public.messages;
drop policy if exists messages_delete_sender on public.messages;

drop policy if exists reports_insert_self on public.reports;
create policy reports_insert_self on public.reports
for insert to authenticated
with check (
  reporter_id=(select auth.uid())
  and (
    reported_message_id is null
    or exists(
      select 1
      from public.messages m
      where m.id=reports.reported_message_id
        and public.is_conversation_participant(
          m.conversation_id,
          (select auth.uid())
        )
    )
  )
);

drop policy if exists hidden_self on public.message_hidden;
create policy hidden_self on public.message_hidden
for all to authenticated
using (
  user_id=(select auth.uid())
  and exists(
    select 1 from public.messages m
    where m.id=message_hidden.message_id
      and public.is_conversation_participant(
        m.conversation_id,
        (select auth.uid())
      )
  )
)
with check (
  user_id=(select auth.uid())
  and exists(
    select 1 from public.messages m
    where m.id=message_hidden.message_id
      and public.is_conversation_participant(
        m.conversation_id,
        (select auth.uid())
      )
  )
);

revoke delete on public.messages from authenticated;
