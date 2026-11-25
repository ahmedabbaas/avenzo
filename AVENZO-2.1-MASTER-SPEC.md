# AVENZO 2.1 — Product, Experience & Visual Master Specification

## Mission
Build AVENZO as a polished, trustworthy, mobile-first social platform with its own recognizable identity. Improve the product as a whole without cloning Instagram, inventing activity, or destabilizing existing working features.

## Product principles
1. Real before decorative: every visible action must work, persist when appropriate, and report loading, success, empty, offline, and error states honestly.
2. Preserve user data: never seed production with fake users, posts, followers, likes, comments, reels, stories, or messages.
3. Progressive disclosure: keep the primary screen calm; place advanced controls in contextual menus and settings.
4. Mobile-first parity: mobile is not a compressed desktop. Use dedicated navigation, safe areas, touch targets, and full-screen flows where appropriate.
5. Accessible by default: semantic HTML, keyboard support, visible focus, labels, reduced motion, and readable contrast.
6. Performance is a feature: avoid unnecessary rerenders, oversized media, layout shifts, blocking effects, and needless dependencies.
7. Ship safely: migrations for schema changes, RLS for user data, tests for domain behavior, preview QA before production.

## Brand and visual identity
- Brand: AVENZO. Do not rename, rebrand, or add unrelated slogans.
- Core palette: Obsidian Chrome, with graphite surfaces, pearl text, and restrained silver/steel metallic accents.
- Prohibited primary accent direction: citron lime, violet, purple, magenta, and saturated blue.
- Dark theme: near-black canvas, layered graphite surfaces, subtle neutral borders, pearl text, muted steel secondary text, and silver accents for primary actions and active states.
- Light theme: neutral off-white canvas, white surfaces, dark ink text, quiet borders, and the same restrained silver/charcoal accent system.
- Silver is a functional accent, not a decorative background wash. Reserve it for primary actions, active navigation, focus rings, progress, and meaningful status.
- Use a restrained shadow system. Prefer spacing, surface contrast, and hairline borders over stacks of glowing cards.
- Avoid excessive gradients, glass effects, neon glow, pill overload, giant headings, and unnecessary decoration.
- Typography: Plus Jakarta Sans / system fallback. Establish a consistent scale: 11–12px metadata, 13–14px controls/body compact, 15–16px body, 20–24px section titles, 30–40px page titles. Never shrink text to force a layout to fit.
- Spacing: 4px base rhythm; use consistent 8/12/16/20/24/32px steps.
- Radius: small controls 10–12px, surfaces 16–20px, large feature surfaces 22–26px. Do not round every element identically.
- Borders: subtle neutral 1px borders; stronger border only for focus, selected, or active state.

## Icons and brand assets
- Use the existing centralized Icon component as the single icon source for product UI.
- Keep one consistent stroke family, stroke width, optical size, and alignment.
- Default icon sizes: 16px compact metadata, 18–20px controls, 22–24px primary navigation.
- Every icon-only button must have an accessible name, tooltip/title where useful, and a minimum 44px touch target on touch layouts.
- Do not mix emoji, random icon packs, Unicode symbols, and custom SVGs as substitutes for product icons.
- Preserve the official AVENZO logo asset. Do not hue-shift it into another brand color or distort its aspect ratio.
- User-uploaded avatars/media must preserve aspect ratio and use predictable object-fit behavior.

## Navigation and information architecture
- Desktop: stable top bar, clear primary navigation, readable content column, optional contextual right rail. Avoid excessive empty columns.
- Mobile: compact top bar and fixed bottom navigation with Home, Search, Create, Reels, Profile. Respect safe-area insets.
- Create is icon-led; do not force an extra label into the mobile nav.
- Hide global nav when a focused full-screen workflow requires it, including compose, story viewer, and focused conversation.
- Active navigation must be clear without relying on color alone.
- Notification dots/counts must reflect real unread data only.
- No horizontal page overflow at 320px, 360px, 390px, tablet, or desktop widths.

## Core social features
- Authentication: sign up, sign in, verification, recovery, username availability, and clear validation/error states.
- Feed: latest/top sorting, stable loading skeletons, pagination/infinite loading where supported, real posts only, clear empty state.
- Posts: image/video media, captions, likes, comments, saves, share, repost where supported, author actions and report controls.
- Stories: real 24-hour content, clear progress, pause/resume, mute, reply/interaction where supported, safe exit.
- Reels: real video playback, mute, playback state, captions/actions, responsive viewport behavior, data-saving preferences.
- Discovery: real search, people/content discovery, filters that actually affect results, no fabricated recommendations.
- Profiles: avatar, bio, counts, follow state, posts/reels/tagged sections, edit profile, safety actions.
- Messaging: inbox, requests, primary/general folders where supported, unread state, realtime updates, attachment validation, drafts, message actions, privacy and block/report controls. Inbox selections open a dedicated, shareable `/messages/[username]` conversation route. Desktop receives a focused conversation workspace; mobile receives a full-screen conversation with a back path to the inbox.
- Notifications: real event types, read/unread state, sensible grouping, empty/loading/error states.
- Saved collections: real saved items, collection management, empty states.
- Settings: grouped and searchable where useful; clear labels, descriptions, toggles, confirmation for destructive actions, persistent preferences.
- Safety: block, restrict, report, privacy settings, rate limits, and RLS. Never expose private data through client-only checks.

## Interaction and motion
- All controls need default, hover, focus-visible, pressed, disabled, loading, and error states as applicable.
- Motion should clarify state changes, not delay interaction. Typical transitions 140–220ms with a restrained ease curve.
- Respect prefers-reduced-motion globally.
- Avoid layout jumps; reserve media dimensions and stable skeleton geometry.
- Provide optimistic updates only when rollback/error handling exists.
- Prevent double submissions and show action feedback.

## Responsive and accessibility requirements
- Test 320, 360, 390, 430, 768, 1024, 1280, and 1440px widths.
- Touch targets at least 44x44px for primary touch controls.
- Use semantic buttons/links, form labels, dialog semantics, aria-live for status messages, and descriptive alt text for meaningful images.
- Keyboard users must reach every action and see focus.
- Maintain WCAG AA contrast for normal text (4.5:1) and large text (3:1).
- Ensure text zoom and browser zoom do not hide controls.
- Respect safe-area insets on iOS/Android shells.

## Backend, privacy and security
- Keep Supabase Auth, PostgreSQL, Storage, Realtime, and Edge Functions as the existing backend foundation.
- Enforce authorization in database RLS and server-side operations, not just in UI.
- Validate file type and size on both client and server/storage policy.
- Never expose service-role secrets in browser code.
- Use migrations for schema changes and document rollback implications.
- Rate-limit sensitive auth and abuse-prone actions.
- Handle realtime reconnects, offline state, and stale data without duplicating events.
- Collect only data needed for product behavior.

## Performance and reliability
- Keep client bundles lean; do not add a dependency for a small utility.
- Use image dimensions, responsive sizing, lazy loading, and video poster/preload discipline.
- Avoid unnecessary global listeners and clean up subscriptions/timers/media streams.
- Prevent duplicate network requests and stale async state updates.
- Use stable keys and memoization only where measurement justifies it.
- Keep production build, lint, TypeScript, unit/contract tests, and migration checks green.

## QA and release gates
- Inspect existing implementation before changing it. Reuse existing features; do not create duplicate routes or controls.
- Test auth, feed, create/upload, story, reel, profile, search, messaging, notifications, saved, settings, safety, and logout.
- Test dark/light theme and persisted preferences.
- Test empty, loading, offline, permission-denied, upload-failure, and server-error states.
- Test desktop and mobile browser behavior, keyboard navigation, and reduced motion.
- Verify actual Vercel preview and runtime logs before production release.
- Do not claim complete QA if only a subset was inspected.
- Do not deploy to production unless the release workflow and explicit user authorization permit it.
- Do not claim an Android signed release unless signing and artifact verification succeeded.

## Definition of done
A change is done only when it is implemented in the real app, uses real data, has no dead controls, passes relevant automated checks, has been manually checked at its affected breakpoints, and its limitations are documented. A visual mockup or static screenshot is not a shipped feature.
