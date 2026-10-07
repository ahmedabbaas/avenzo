# AVENZO social experience implementation prompt

Improve the existing AVENZO app to match the familiar usability and feature depth of Instagram, while retaining AVENZO branding, its Obsidian Chrome design system, and its existing architecture. Deliver working features backed by real user data. Do not fabricate accounts, followers, engagement, or completed functionality.

## Product requirements

1. Home: responsive feed, avatar/username/location headers, stories row, image/video/carousel posts, swipe and keyboard carousel navigation, position indicators, like/comment/share/save actions, double-tap like, expandable captions, comments/replies, timestamps, pagination and useful loading/empty/error states.
2. Stories: create from validated media, progress indicators, next/previous navigation, pause on interaction, close/back support, seen state and privacy enforcement. Expired stories must not remain visible.
3. Reels: vertical navigation, active-video playback, offscreen pause, mute preference, like/comment/share/save, captions, author follow action, accessible controls and data-saving behavior.
4. Explore/search: searchable accounts and content, recent queries, media grid, pagination, clear results states and privacy/block filtering. Prevent stale search responses from overwriting newer results.
5. Profile: visible identity header, avatar, bio, counts, edit/follow/message actions, settings entry, posts/reels/tagged/saved tabs where authorized, grid and post viewer. Respect private accounts and ownership.
6. Messages: conversation list, visible recipient identity and back button, text/media sending, delivery states, permissions, retry without duplicate sends, readable timestamps and attachment validation. Calls must accurately reflect connection state.
7. Creation: validated media selection, carousel ordering, preview, caption/hashtags/mentions/location, upload progress, recoverable drafts, cancel and publish feedback. Failed publication must preserve the draft.
8. Activity/settings: meaningful real notifications, privacy/security/account settings, theme and data-saving preferences, accessible logout and accurate unread indicators.

## Engineering and acceptance requirements

Inspect each existing implementation before changing it. Improve and reuse existing components instead of rebuilding working flows. Centralize visual changes in app/avenzo-design-system.css and check mobile-shell/app-mobile.css compatibility. Preserve authorization, Supabase RLS, rate limits, block rules and upload safeguards. Never put privileged credentials in browser code.

Provide responsive mobile/desktop layouts, visible touch targets, keyboard navigation, focus states, descriptive accessible names and reduced-motion support. Prevent duplicate mutations, roll back optimistic updates on failure, clean up listeners/timers, avoid unbounded requests and pause inactive media. Preserve screen position and drafts where appropriate.

Implement in reviewable phases. For every phase review functionality, edge cases, visual consistency, Android parity, accessibility, security, performance and regressions. Run npm run verify. Deploy approved changes to Vercel production, verify the exact commit and production alias, and clearly identify any device or signed-in flows that could not be tested. Do not describe partial implementation as complete Instagram parity.

## This release

Adds feed caption expansion, accessible carousel arrow/keyboard navigation, and visible mobile comment toggles. The other requirements above are the continuing implementation specification, not claims that this release completes or verifies them.
