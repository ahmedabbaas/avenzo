# AVENZO

AVENZO is a production-oriented social platform built around real accounts, permanent unique usernames, user-generated posts/reels/stories, follows, private conversations, safety controls and responsive mobile/desktop UX.

## Product foundations

- Login-first authentication flow
- Unique permanent @usernames enforced in PostgreSQL
- Email verification and password recovery
- Real profiles with avatars, bios and follower/following counts
- Home feed limited to the current user + followed accounts
- Real image/video posts with likes, comments, saves and sharing
- Real video reels with likes, comments and saves
- Real image/video stories that expire after 24 hours
- Realtime direct messages with unread states
- Activity notifications
- Public in-app profile routes at `/u/[username]`
- Follow, block, unblock and report safety controls
- Responsive desktop/mobile navigation
- Loading, empty, error and 404 states
- Optional Cloudflare Turnstile abuse protection
- Database-backed login/signup/password-reset/username-check rate limiting
- Supabase Row Level Security
- GitHub quality gate + Vercel production deployment

AVENZO does not seed production with fake users, fake followers, fake posts, fake reels, fake stories, fake likes or fake comments.

## Stack

- Next.js 16
- React 19
- TypeScript
- Supabase Auth
- PostgreSQL + Row Level Security
- Supabase Storage
- Supabase Realtime
- Supabase Edge Functions
- Vercel

## Environment

Copy `.env.example`.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

Turnstile is optional. When it is not configured, the app continues without the challenge layer.

Public Supabase URL/publishable-key fallbacks exist in the app for the current AVENZO project. Private admin/service-role secrets are not required by the Vercel app.

## Database

All production schema changes are migration-driven:

```text
supabase/migrations/001_avenzo.sql
supabase/migrations/002_security_hardening.sql
supabase/migrations/003_real_content_reels_stories.sql
supabase/migrations/004_blocked_accounts_management.sql
supabase/migrations/005_auth_rate_limiting.sql
supabase/migrations/006_optimize_rls_auth_uid.sql
supabase/migrations/007_image_media_dimensions.sql
supabase/migrations/008_harden_media_bucket_uploads.sql
```

These migrations cover:

- username reservation
- profiles
- follows
- posts / likes / comments / saves
- reels / reel likes / reel comments / reel saves
- 24-hour stories
- messages
- notifications
- blocking / unblocking
- reporting
- storage policies
- realtime publication
- RLS policies and security hardening
- database-backed authentication rate limiting
- optimized auth lookups inside RLS policies
- stored image dimensions for stable/optimized media rendering
- storage-level 25 MB upload enforcement and allowed media MIME types

Do not manually seed or edit production as the normal workflow. Use migrations for schema changes.

## Architecture

The social domain is being split out of the main client shell under:

```text
features/social/
  components/
  data/
  lib/
  types.ts
```

Keep reusable UI/domain logic out of `app/home-client.tsx` as the app grows. The create-content modal, story viewer, feed cards, settings, profile, messaging, queries and mutations are split into domain modules instead of living in one page component.

## Local development

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run lint
npm run typecheck
npm run build
```

GitHub Actions runs these checks for `main` and pull requests. Unit coverage currently includes authentication validation and social upload validation.

## Production

The `main` branch is connected to the AVENZO Vercel project.

Before considering a release complete:

- lint must pass
- TypeScript must pass
- production build must pass
- migrations must be verified
- protected routes must be tested
- mobile layout must be checked
- upload and auth failure states must be checked
- rollback/deployment status must be understood
