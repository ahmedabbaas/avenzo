# AVENZO web-first rebuild — 6 October 2026

## Architecture and risk report before implementation

Baseline: production main `2a6481edf00b0e1b0c4420b0522b09429852874c`.
Next.js 16.3.6 / React 19.2.8; Supabase Auth, database, storage and realtime;
Capacitor 8 Android shell loads the production web origin. Existing database
permissions and account data must be preserved.

The initial source audit found 15,853 lines of globals, 3,529 lines of canonical
design-system CSS, and 17,000 lines of native compatibility CSS. Native styles
are layered, but shared product styles still contain repeated historical theme
and geometry definitions. Do not delete all styles indiscriminately; consolidate
each affected component with regression evidence.

Create opens a Post directly, including from Clips and public route navigation.
Device-local IndexedDB drafts already exist but are exposed inside the composer.
The settings hub still mounts a bottom dock despite the requested hidden dock.
Draft writes currently resolve on request success rather than transaction commit,
so a late transaction failure could be reported as a successful save.
System-theme changes update DOM colors but do not notify theme event subscribers.
The Git worktree pointer refers to a workspace that no longer exists; publish
through the authenticated GitHub connector with an expected-head lease.

## Master implementation specification

Evolve AVENZO in place. Preserve users, posts, messages, uploads, deep links,
permissions, rounded original logo and functioning features. No dummy content,
artificial APK size padding, reintroduced verification badge, or competing
theme appended to globals. Shared product design lives in
`app/avenzo-design-system.css`; native code owns device capabilities, not a
second version of product layout.

Use quiet premium light/dark/system themes with graphite/silver surfaces,
readable type, a consistent icon family, 4/8px spacing rhythm, 44px touch targets,
stable media geometry, and reduced-motion/large-text/high-contrast support.
Reference images are design specifications, never product data.

Audit and verify Home, Discover, profile from every entry point, connections,
saved collections, authentication, upload, Moments, Clips, messages, calls,
notifications and settings. Each needs loading, empty, error, retry and pending
states. Counts and people must come from real data. Authorization stays at the
server/database boundary. Never present unverified calling or push as working.

Mobile primary tabs: Home, Discover, centered Create, Clips, Profile. Hide dock
in settings, composer, full-screen Moment and active call. Back closes overlays
before navigation; root exit remains Android-only. Preserve relevant tab state.
Verify 320/360/390/430/768/1024/1440 widths, landscape, text zoom, keyboard and
gesture safe areas. Browser preview is not physical Android evidence.

Create opens a shared bottom sheet: Post, Moment, Clip, Drafts. Reuse existing
upload/edit/publish and draft flows; maintain MIME/size validation, reachable
publish controls, truthful progress, prevention of duplicates, draft recovery
and preview/apply/undo for native tools. Transaction failure must never be
reported as a saved draft.

Feed preserves natural image ratios and stable carousel frames. Profile and
Discover thumbnails are square, three equal columns on phones. Profile owns
one canonical header with aligned stats and permission-aware actions.
Global search must be implemented against bounded privacy-aware queries, not
present filtering a loaded page as complete search. Pause offscreen videos,
keep only the active Clip playing, paginate and honor actual data-saving rules.

Messaging needs stable keyboard/scroll geometry, membership enforcement and
idempotent retries. Calls need truthful transport state and two-device audio
verification. Push needs distinct foreground/background/killed-process gates.
Add useful missing capabilities after checking existing ones: discoverable
Draft Studio, reading comfort, effective data saver, collections, feed controls,
upload recovery, real creator insights and accessible publishing tools.

## Phases and release gates

1. Shared foundation, appearance and Create/Drafts entry points.
2. Feed, profile and privacy-aware Discover/search.
3. Upload/media/Clips/Moments.
4. Messaging/calls/settings and remaining genuine features.
5. Full web stabilization and deployment.
6. Android integration, device verification, signed APK and verified delivery.

After each phase review architecture, functional edge cases, UI alignment,
typography/icons, responsive parity, accessibility, security, performance and
regressions. Run repository verification. Record evidence and remaining gates.
Do not call the complete redesign done after only phase 1.

## Phase 1 design reference analysis

The standalone Create-sheet reference uses a white surface over dimmed content,
24px top corners, about 20px gutters, 24px title, 14px supporting text, four flat
rows with 44px icon tiles and trailing chevrons, and a separated device-local
draft note. Implementation uses the same structure and shared theme tokens;
dark mode substitutes charcoal rather than a separate layout. On short screens
the sheet scrolls within the visual viewport. The cosmetic drag handle is omitted
unless drag-to-dismiss is implemented; close/back/Escape remain explicit.

## Evidence ledger

Initial source audit only. Authenticated browser, responsive rendering and
physical Android verification are not yet complete. Each subsequent phase must
append its actual checks and limitations here.

### Phase 1 review

Implemented shared Create launcher with Post/Moment/Clip/Drafts from primary
navigation on all existing routes and desktop Home entry points. Drafts reuse
IndexedDB and the existing composer; drafts deep links are parsed on the server.
Settings no longer mounts a primary dock. Modal lifecycle now isolates background
content on all routes, traps focus, restores inert state, handles visual viewport
and Escape, and retains existing Android Back recognition via `.modal` and Close.
Cleaned keyboard blur timer. System-theme subscribers receive updates and corrupt
stored theme values fall back to system. Increased light-theme secondary text
contrast. IndexedDB writes wait for transaction commit; queries use userId index.

Architecture/functional/UI/typography/responsive/accessibility/security/performance/
regression source review completed. No schema/RLS/auth changes; no new packages or
fake content. `npm run verify` passed (contracts, native bridge, meaningful draft
commit/late-abort tests, lint, TypeScript, Next production build). Browser authenticated
with the real account. Browser cannot reach local 127.0.0.1, so a signed-in `/review`
route opens requested-size windows of actual existing routes for deployed responsive
inspection. Initial iframe approach was rejected because the existing CSP forbids
framing; CSP and X-Frame-Options remain intact. Window dimensions must be observed
before reporting any responsive result. It is not linked from product navigation and is not Android evidence.
Live responsive inspection is the next gate; physical Android remains pending.

### Phase 2 audit and design intent before search implementation

Discover currently filters up to 36 loaded Explore posts, 32 Clips and a bounded
people list in HomeClient. A result beyond that window cannot be found. Extend
existing query/hydration helpers with a cookie-authenticated, bounded endpoint;
retain RLS for block/private-content filtering. Add debouncing, stale-response
protection, pagination, deduplication, accessible loading/error/retry and a truthful
loaded-results count. No new schema is required. Existing feed browsing and
category filters remain intact. Supabase JS or/range documentation reviewed;
changelog markdown retrieval was unsupported by the web tool. Existing installed
SDK supplies these methods. New search must be live-tested before completion.

### Text-post audit and implementation

The existing database permits nonempty caption-only posts (`posts_have_content`),
publication mutation handles null media, feed/explore render text content, but the
Home validation and composer require a photo. Enable a 'Write a text post instead'
entry in the existing Post composer, skip photo editing, require nonempty text,
retain details/review/publish and restore text drafts into Details. Add early empty
post validation in the publication helper. No schema/privilege changes, duplicate
publisher or fake success. Live review can exercise the editor without publishing
content to other users; actual publishing requires a deliberately authored post.

### Phase 2 verification

Full repository verification passed: contracts, native bridge, draft transaction,
search normalization/injection tests, lint, TypeScript and production build.
Production commit 9db3f4 deployed READY. Authenticated live Discover search for
the actual account username returned its four existing accessible posts from
the server endpoint. Create -> Post -> Write a text post -> Details -> Review
worked with no media; empty text kept Continue disabled. Test text was not
published. Background content was isolated while modal was open. Live desktop
inspection found default input/control geometry in Discover; canonical search
bar styles were corrected. Text flow uses consecutive displayed step numbers.
Responsive phone and physical Android behavior remain unverified; this is not
completion of the full multi-phase redesign.
