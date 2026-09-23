# AVENZO

AVENZO is a modern social platform focused on real accounts, unique permanent usernames, posts, follows, private conversations, safety controls and a polished responsive experience.

## Product foundations

- Login-first authentication flow
- Unique permanent @usernames
- Email verification and password recovery
- Real profiles with avatars, bios and follower counts
- Latest and Following feeds
- Image/video posts, likes, comments and saves
- Realtime direct messages with unread states
- Activity notifications
- Shareable in-app profile routes at `/u/[username]`
- Follow, block and report safety controls
- Responsive desktop/mobile navigation
- Production loading, error and 404 states
- Optional Cloudflare Turnstile abuse protection
- Supabase Row Level Security model
- Vercel deployment and GitHub quality gate

## Stack

- Next.js 16
- React 19
- TypeScript
- Supabase Auth, Postgres, Storage and Realtime
- Vercel

## Required environment

Copy `.env.example` and configure:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

Turnstile is optional. If its site key and secret are not configured, AVENZO auth continues without the challenge layer.

## Database

The production schema lives at:

`supabase/migrations/001_avenzo.sql`

It includes username reservation, profiles, follows, posts, likes, comments, saves, messages, notifications, blocking, reporting, RLS policies, storage policies and realtime publications.

## Local development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm run build
```

## Production

The main branch is connected to Vercel. Pull requests and the premium release branch are validated with the AVENZO Quality Gate before production merge.
