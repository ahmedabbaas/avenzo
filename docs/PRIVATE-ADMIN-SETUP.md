# AVENZO Private Admin Panel

The private dashboard lives at `/admin`. Authorization is enforced server-side by the signed-in user's verified Supabase email. An unknown email redirects to the root route; the admin settings API also checks the email for every request.

## Required Vercel server environment variables
- `AVENZO_ADMIN_EMAIL`: exact email address used by the administrator's AVENZO account.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role key. Server-only; never use a `NEXT_PUBLIC_` prefix and never expose this key in browser code.

The migration `supabase/migrations/202611260001_admin_settings.sql` creates a table with RLS enabled and no client policies. Apply it to the Supabase project before using Save.

## Scope in this initial panel
Brand name/tagline/logo and icon URLs, color tokens, font family, feature toggles, maintenance-mode flag, and custom CSS storage. This initial release saves configuration safely, but does not yet wire every saved value into every public page, implement binary file uploads, or enforce feature switches globally. Those integrations are separate follow-up work.
