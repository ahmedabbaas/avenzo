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
      'message',
      'message_request',
      'message_reply',
      'message_reaction',
      'collab_invite',
      'collab_accepted'
    )
  );

create table if not exists public.post_collaborators (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key(post_id,user_id)
);

create index if not exists post_collaborators_user_status_idx
  on public.post_collaborators(user_id,status,created_at desc);

alter table public.post_collaborators enable row level security;

drop policy if exists post_collaborators_read on public.post_collaborators;
create policy post_collaborators_read
on public.post_collaborators
for select to authenticated
using (
  status='accepted'
  or user_id=(select auth.uid())
  or invited_by=(select auth.uid())
  or exists(
    select 1 from public.posts p
    where p.id=post_id and p.author_id=(select auth.uid())
  )
);

create or replace function public.invite_post_collaborators(
  target_post uuid,
  collaborator_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  candidate uuid;
  unique_ids uuid[];
  inserted_count integer:=0;
begin
  if uid is null then
    raise exception using errcode='42501',message='UNAUTHENTICATED';
  end if;

  if not exists(
    select 1 from public.posts p
    where p.id=target_post and p.author_id=uid
  ) then
    raise exception using errcode='42501',message='NOT_POST_OWNER';
  end if;

  select array_agg(distinct x)
  into unique_ids
  from unnest(coalesce(collaborator_ids,'{}'::uuid[])) x
  where x is not null and x<>uid;

  if coalesce(array_length(unique_ids,1),0)>3 then
    raise exception using errcode='22023',message='TOO_MANY_COLLABORATORS';
  end if;

  if unique_ids is null then
    return 0;
  end if;

  foreach candidate in array unique_ids loop
    if not exists(select 1 from public.profiles p where p.id=candidate) then
      continue;
    end if;
    if public.users_blocked(uid,candidate) then
      continue;
    end if;

    insert into public.post_collaborators(
      post_id,user_id,invited_by,status,created_at,responded_at
    )
    values(target_post,candidate,uid,'pending',now(),null)
    on conflict(post_id,user_id)
    do update set
      invited_by=excluded.invited_by,
      status='pending',
      created_at=now(),
      responded_at=null;

    insert into public.notifications(recipient_id,actor_id,type,created_at)
    values(candidate,uid,'collab_invite',now());

    inserted_count:=inserted_count+1;
  end loop;

  return inserted_count;
end;
$$;

revoke execute on function public.invite_post_collaborators(uuid,uuid[])
from public,anon;
grant execute on function public.invite_post_collaborators(uuid,uuid[])
to authenticated;

create or replace function public.respond_post_collaboration(
  target_post uuid,
  accept_invite boolean
)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  inviter uuid;
  next_status text;
begin
  if uid is null then
    raise exception using errcode='42501',message='UNAUTHENTICATED';
  end if;

  select pc.invited_by
  into inviter
  from public.post_collaborators pc
  where pc.post_id=target_post
    and pc.user_id=uid
    and pc.status='pending';

  if inviter is null then
    raise exception using errcode='P0002',message='COLLAB_INVITE_NOT_FOUND';
  end if;

  next_status:=case when accept_invite then 'accepted' else 'declined' end;

  update public.post_collaborators
  set status=next_status,
      responded_at=now()
  where post_id=target_post
    and user_id=uid;

  if accept_invite then
    insert into public.notifications(recipient_id,actor_id,type,created_at)
    values(inviter,uid,'collab_accepted',now());
  end if;

  return next_status;
end;
$$;

revoke execute on function public.respond_post_collaboration(uuid,boolean)
from public,anon;
grant execute on function public.respond_post_collaboration(uuid,boolean)
to authenticated;

create or replace function public.cancel_post_collaboration(
  target_post uuid,
  collaborator uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then
    raise exception using errcode='42501',message='UNAUTHENTICATED';
  end if;

  if not exists(
    select 1 from public.posts p
    where p.id=target_post and p.author_id=uid
  ) then
    raise exception using errcode='42501',message='NOT_POST_OWNER';
  end if;

  delete from public.post_collaborators
  where post_id=target_post and user_id=collaborator;
end;
$$;

revoke execute on function public.cancel_post_collaboration(uuid,uuid)
from public,anon;
grant execute on function public.cancel_post_collaboration(uuid,uuid)
to authenticated;
