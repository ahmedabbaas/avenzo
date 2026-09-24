alter function public.direct_conversation_key(uuid, uuid)
  set search_path = public;

revoke execute on function public.notify_message_reaction()
  from public, anon, authenticated;

revoke execute on function public.touch_conversation_from_message()
  from public, anon, authenticated;
