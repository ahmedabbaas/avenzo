# Rich social surfaces — architecture and review

## Existing architecture and risk assessment

AVENZO uses Next.js App Router with a Capacitor Android shell loading the production site. Cookie-authenticated Supabase queries retain the existing RLS, privacy, block and permission boundaries. Discovery already had a debounced authenticated API and abort handling. Profile grid links used a basic `/p/[id]` page on web and an interactive mobile-only profile feed on Android. Messaging supports direct conversations, requests, notes, groups, channels, attachments and calls. The composer already supports drafts, editing, tags, polls and accessibility fields.

The main risks are competing native CSS, post-action regressions when sharing the existing viewer, prefix pagination at page boundaries, and hiding working composer/messaging controls. No schema migration, permission expansion or replacement data layer is needed.

## Design analysis

Four individual mobile references informed the design: Messages, Discover, post detail and Create. Common geometry is 16–20px gutters, 44px interaction targets, readable 14–16px body text, 48–54px round avatars, flat content rows, neutral white/graphite surfaces and simple underlined navigation. Media retains its proportions with a clean frame. Existing Plus Jakarta Sans is kept for consistent web/native typography instead of copying generated serif text. Fictional reference content is never added to application data.

## Phase 1: discovery and posts

Prefix profile matches come before broader name/username matches, using the database prefix count to retain pagination without duplicates. Existing authenticated queries and input validation remain. Own search results have no self-follow button. Result types distinguish People, Posts, Reels and All; categories remain available outside search. Abort handling rejects stale timed-out requests.

The existing interactive profile-post viewer is moved to a shared component. `/p/[id]` hydrates the actual requested post with likes, comments, carousel, poll and save state. The Android route re-exports the shared viewer. The single-post refresh queries the exact post rather than an arbitrary profile-page subset. Mutation failures display feedback and repeated like/save/repost taps are guarded while in flight.

Review: route/auth/data boundaries inspected, server/client props remain serializable, post actions reuse existing mutations, native parity uses shared styles, loading/error states remain, and prefix pagination is tested at 0/1/23/24/25/48/50 matching profiles.

## Phase 2: messages and create

The inbox has a single compose action, compact tools, optional expandable Notes, an always-visible search field, underlined folders and open conversation rows. The canonical surface is shared on web/native rather than displaying a second legacy mobile inbox. Existing messaging/call permissions and data operations remain intact.

Composer details show the selected media and expose optional poll/tag/collaborator controls through native keyboard-accessible disclosures. Existing upload validation, progress, draft saving, focus trap, keyboard viewport handling and duplicate-upload prevention remain. The fixed action area retains safe-area spacing. Native profile feed colors now follow native theme tokens.

Review: accessibility labels/focus styles, desktop/narrow layout, light/dark token contrast, safe areas, preserved optional controls, existing realtime subscriptions, and no new runtime dependencies.

## Validation

Repository quality gate includes project contracts, native bridge cases, draft lifecycle tests, discovery query tests, visual CSS/contrast checks, lint, TypeScript and optimized production build. Live browser checks follow deployment; evidence and remaining device-specific limitations are reported separately. An Android device and two-account send/receive tests are required to claim complete native or messaging end-to-end validation.
