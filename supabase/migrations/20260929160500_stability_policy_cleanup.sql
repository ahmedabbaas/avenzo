-- AVENZO stability cleanup: remove redundant indexes and overlapping permissive policies.

drop index if exists public.saved_collection_items_collection_post_uq;
drop index if exists public.saved_collection_items_collection_reel_uq;

drop policy if exists broadcast_reactions_write on public.broadcast_channel_reactions;

create policy broadcast_reactions_insert_self
on public.broadcast_channel_reactions
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.broadcast_channel_posts p
    where p.id = broadcast_channel_reactions.post_id
      and exists (
        select 1
        from public.broadcast_channels bc
        where bc.id = p.channel_id
          and (
            bc.is_public
            or public.current_user_is_channel_member(p.channel_id)
          )
      )
  )
);

create policy broadcast_reactions_update_self
on public.broadcast_channel_reactions
for update
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.broadcast_channel_posts p
    where p.id = broadcast_channel_reactions.post_id
      and exists (
        select 1
        from public.broadcast_channels bc
        where bc.id = p.channel_id
          and (
            bc.is_public
            or public.current_user_is_channel_member(p.channel_id)
          )
      )
  )
);

create policy broadcast_reactions_delete_self
on public.broadcast_channel_reactions
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists group_reactions_member_write on public.group_message_reactions;

create policy group_reactions_member_insert
on public.group_message_reactions
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.group_messages gm
    where gm.id = group_message_reactions.message_id
      and public.current_user_is_group_member(gm.group_id)
  )
);

create policy group_reactions_member_update
on public.group_message_reactions
for update
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.group_messages gm
    where gm.id = group_message_reactions.message_id
      and public.current_user_is_group_member(gm.group_id)
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.group_messages gm
    where gm.id = group_message_reactions.message_id
      and public.current_user_is_group_member(gm.group_id)
  )
);

create policy group_reactions_member_delete
on public.group_message_reactions
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.group_messages gm
    where gm.id = group_message_reactions.message_id
      and public.current_user_is_group_member(gm.group_id)
  )
);

drop policy if exists notes_owner_write on public.notes;

create policy notes_owner_insert
on public.notes
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy notes_owner_update
on public.notes
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy notes_owner_delete
on public.notes
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists reposts_owner_delete on public.reposts;
drop policy if exists reposts_owner_insert on public.reposts;
drop policy if exists reposts_owner_update on public.reposts;
