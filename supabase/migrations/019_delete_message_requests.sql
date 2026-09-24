create or replace function public.delete_message_request(cid uuid)
returns void
language plpgsql
security definer
set search_path=public
as $delete_request$
declare uid uuid:=auth.uid();
begin
  update public.message_requests
  set status='deleted',responded_at=now()
  where conversation_id=cid
    and recipient_id=uid
    and status='pending';

  if not found then
    raise exception using errcode='42501',message='REQUEST_NOT_AVAILABLE';
  end if;
end;
$delete_request$;

revoke execute on function public.delete_message_request(uuid)
  from public,anon;
grant execute on function public.delete_message_request(uuid)
  to authenticated;
