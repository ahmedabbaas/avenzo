-- Verification badges/admin controls were retired from AVENZO.
-- Keep the legacy profiles.verified column for backward-compatible payloads,
-- but remove the mutation/search RPC surface so the feature cannot be managed.

drop function if exists public.set_profile_verification(uuid, boolean);
drop function if exists public.get_verification_candidates(text);
