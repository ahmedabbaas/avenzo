# AVENZO — Original Social Platform Master Implementation Prompt

## Mission

Act as the product engineer, designer and release engineer for the existing AVENZO web and Android app. Deliver the depth and reliability users expect from an Instagram-class social platform while keeping AVENZO's original identity. Implement this specification in the existing project in verified phases. This document is a target specification, not a claim that all features are complete.

## Preserve the original project

1. Inspect routes, components, data flows, database migrations, RLS, native bridges, tests and deployment configuration before modifying an area.
2. Improve working components. Preserve account data, URLs, auth, permissions and existing user workflows. Document a concrete reason and regression protection before any replacement.
3. Keep the existing Next.js App Router, React, Supabase and Capacitor/Java architecture. Do not add Python, Bootstrap or another framework simply to increase the stack size.
4. Keep AVENZO's logo, original copy, Obsidian Chrome palette, silver/graphite accents and light/dark/system themes. Use `app/avenzo-design-system.css` as the visual authority and maintain Android parity.
5. Keep the primary navigation: Home, Discover, Create, Clips, Profile. Keep Messages in the header and contextual profile actions. Use Moments for the original story concept.
6. Do not introduce Instagram branding, logos, proprietary assets or identical screen compositions. Study familiar interaction patterns and create AVENZO's own layout and icon treatment.
7. Do not reintroduce verification badges, Echoes, lime or pink themes.
8. No fake people, fake counts, seeded activity, dead buttons, artificial APK padding or success states before server confirmation.

## Engineering baseline and evidence

The current project has Next.js/React, Supabase Auth/Postgres/Realtime/Storage and an Android WebView shell. Existing code includes feed posts, carousels, polls, stories, Clips, social connections, profile pins, messages, call history, WebRTC and account controls. Inspect actual code and live data before assigning an implementation status. A route or checkbox is not evidence of a tested feature.

For each capability track: existing implementation, missing behavior, changed files, data/policy dependencies, automated evidence, live/device evidence and remaining gate. Never label a mocked test as a physical-device test.

## 1. Application shell and navigation

- Mobile bottom navigation must be fixed, equally spaced, readable and safe above Android gesture navigation. The centered Create action must work from every core route.
- Preserve tab position and content state where practical. Deep links must open the actual requested post, Clip, conversation or profile.
- Hide the bottom navigation in Settings, content creation/upload, full-screen Moments and calls. Account for keyboard visibility.
- Back closes a modal first, then returns one route. Android can exit only at the root; Edit Profile returns to the profile that opened it.
- Handle portrait/landscape, 320/360/390/430/480 px phones, tablets, safe areas, browser text zoom and display cutouts without overflow.
- Use original header layouts, aligned icons, visible focus states, 44–48 px targets and accessible names. Dots/counts appear only for real unread events.

## 2. Identity, accessibility and themes

- Shared spacing, typography, surface, radius, shadow, icon and motion tokens; avoid competing global CSS overrides.
- All product routes, sheets, composers and call dialogs support light, dark and system preferences. Prevent theme flashes.
- Clearly distinguish pressed, selected, disabled, pending and destructive actions. Do not convey status with color alone.
- Respect reduced motion, larger text, high contrast and keyboard navigation. Modal focus must enter, stay inside and return to its trigger.
- Use semantic buttons/links, labels, error descriptions and meaningful media alt text. Avoid long animations and layout shifts.

## 3. Authentication and account lifecycle

- Email/username login, registration, email confirmation, session persistence, show/hide password and password reset.
- Validate empty values, email, username syntax/uniqueness, password strength and matching confirmation. Human-readable errors stay near the field.
- Prevent duplicate requests, handle expired sessions and network failure, preserve safe redirect destinations and restrict unsafe external redirects.
- Audit existing MFA, session/device management, account export and deletion flows before adding duplicates.
- Account deletion requires reauthentication where appropriate, clear scope, confirmation, server authorization and documented media/data cleanup.
- Never authorize using editable user metadata; never expose service-role credentials.

## 4. Home and feed

- Real Following and discovery feeds, chronological baseline and transparent original recommendation controls.
- Image, text, video, multi-media/carousel and poll posts with author, caption, location, tags, timestamp and accurate metrics.
- Like/unlike, double-tap animation, comments/replies, save, share, copy link, repost, follow/request/unfollow, report, edit own caption and delete own post.
- Optimistic changes must roll back on failure. Serialize or disable conflicting requests so rapid taps cannot corrupt counts.
- Add cursor-based pagination with stable ordering and deduplication. Preserve scroll position after opening media or profiles.
- Support hide/not interested and original recommendation explanations through persisted user-scoped preferences.
- Keep image aspect ratio, correct responsive image sizes and high-DPI candidates. Pause offscreen videos; never block normal scrolling with media gestures.

## 5. Create, editing and publishing

- Gallery/camera, multi-image ordering/removal, crop, rotate, basic filters, brightness and contrast.
- Caption, hashtags, mentions, collaborators, location, alt text, audience and supported poll controls.
- Retain editable local drafts including media; clearly distinguish local drafts from cross-device drafts.
- Validate MIME signatures/type, file size, media dimensions and permissions at client and server boundaries.
- Publish is always reachable above keyboard/safe area. Show honest progress, disable duplicate publishing and preserve draft on failure.
- Update feed/profile only after a successful persisted result. Clean up abandoned media safely.
- Resume/background upload and scheduled publishing need real server/worker support, idempotency, retry budgets and documented cancellation.

## 6. Moments

- Image/video stories, 24-hour expiration enforced by queries/server rules, seen/unseen state and viewer counts for the owner.
- Progress bars, previous/next, tap zones, pause while holding, close and swipe-down. Pause on background or open dialogs.
- Archive, highlights and Close Friends must obey audience/privacy rules across every entry point.
- Reactions and replies route to actual conversations with story context and unavailable/expired-content states.
- Poll/question stickers require persisted answers and original UI. Do not expose private viewers/answers to other users.

## 7. Clips

- Vertical snap scrolling with one playing video, real thumbnails, play/pause, mute/unmute and accessible controls.
- Like, comments, replies, save, repost, share and direct profile navigation; accurate views without counting rerenders as repeated views.
- Cancel delayed playback when a Clip becomes inactive, the document is hidden or the component unmounts. Release media resources.
- Honor autoplay and data-saving preferences. Preload only nearby metadata; active media can load for explicit playback.
- Show preparation, buffering, unsupported-media, playback-blocked and network-failure states with a working retry.
- Reset observers when category ordering changes. Keep selected Clip IDs and scroll position consistent.
- Pagination and links to older Clips must fetch the requested content rather than silently opening the first 32 items.
- Audio attribution, remix and advanced editing require ownership/licensing rules and real saved output before appearing as actions.

## 8. Discover and search

- Search real users, posts, Clips and tags; show people with avatar/display name/username and navigable results.
- Store recent searches only after explicit submission/selection, per account and device. Limit history, support individual removal and Clear all; storage failure must not break search.
- Distinguish current loaded-content filtering from global search. Global search requires bounded server queries, correct privacy/block filters, pagination and stale-request cancellation.
- Explore uses a responsive media grid with correct ratios. Lazy-load video previews near the viewport and honor data-saving preferences.
- Search suggestions/recent searches contain real queries or actual user/content results, never invented popularity.
- Explicit loading, retry, no-results and empty-library states. Keep entered query when a request fails.

## 9. Profiles and social graph

- Use the same canonical profile layout from tabs, messages, comments, search and notifications.
- Header: username, settings for owner, avatar, display name, bio, optional safe website and equally aligned Posts/Followers/Following stats.
- Owner: Edit Profile/Share Profile; other users: Follow/Requested/Following, Message and More, subject to privacy/block rules.
- Three-column square grid, Posts/Clips/Tagged and owner-only saved content. No image stretching.
- Existing up-to-three post pins must enforce ownership and limit at the database boundary.
- Followers/following lists need search, pagination, follow controls and owner-only remove follower; private content must never flash before access checks.
- Highlights, creator insights and optional original share cards use real data with empty/error states.

## 10. Messaging

- Real inbox, requests, existing folders/groups/channels, search, unread indicators, timestamps and empty states.
- Chat header/profile navigation, message bubbles, delivery/seen state, typing/presence only when current and privacy-permitted.
- Text, images, videos, files, voice messages, replies, reactions, edit, delete for me/everyone, mute and pins.
- Preserve message drafts on failure. Retry sends idempotently to avoid duplicates; validate attachments and protect conversation membership on the server/RLS.
- Voice capture: request permissions when needed, show recording duration/cancel/send, release microphone immediately on stop/route change/error and show playable persisted audio.
- Keyboard-safe composer, scroll anchoring, unread jump and pagination of older messages.
- Profile → Message opens the correct conversation directly. Shared content previews enforce recipient visibility.
- Scheduled messages and channel/group operations need real permissions and server execution, never client timers presented as reliable scheduling.

## 11. Audio and video calls

- Actual 1:1 audio/video: create, ring, accept, decline, cancel, connect, mute, speaker, camera and end.
- Serialize signalling and peer creation. Handle duplicate signals/taps, delayed media permission, ended calls, zero-row updates and second incoming calls.
- Show Connected only after WebRTC transport connection. Keep reconnecting/error states truthful.
- TURN credentials belong on the server, are short-lived and require a configured relay; STUN alone does not guarantee mobile-network calling.
- Handle ICE restart, Wi-Fi/mobile transitions, denied permissions, autoplay restrictions and remote audio gesture recovery.
- Release camera/microphone/wake lock immediately on hangup even if the network update fails.
- Preserve native audio routing and test speaker/headset/Bluetooth on actual Android hardware.
- Incoming-call notifications, foreground service and killed-process delivery need real Android/FCM integration and OS-compliant permission handling.
- Call participant IDs and allowed status transitions must be enforced at the database boundary.
- Verify two physical devices in both directions over Wi-Fi and cellular. A mock browser harness cannot certify audible calls.

## 12. Notifications

- Likes, replies, followers/requests, mentions, messages and calls with real targets, timestamps and unread state.
- Tap opens the correct destination; removed/private content has an appropriate unavailable state.
- Foreground in-app notifications, background push and killed-process push are separate verification gates.
- FCM token lifecycle, per-device registration, logout revocation, invalid-token cleanup, grouping and notification categories.
- Respect mute/privacy preferences. Avoid private message text on lock screens when disabled.

## 13. Privacy, safety and security

- Preserve RLS, private accounts, Close Friends, block/restrict, request permissions, reporting and moderation flows.
- Validate ownership/membership on every mutation and storage operation; reject client privilege flags and forged IDs.
- Apply input bounds, upload allowlists, safe links, CSP, rate limiting and abuse protection without breaking valid workflows.
- Review SELECT/INSERT/UPDATE/DELETE policies, mutable owner fields, security-definer functions, storage visibility and indexes.
- Use reversible/additive migrations where possible. Test authorized and unauthorized operations, not just happy paths.
- Moderation/report queues, appeals, privacy policy and data-safety statements must reflect actual product behavior.

## 14. Performance and media

- Measure first load, navigation, image/video requests, memory and long tasks on a representative phone.
- Prevent duplicate fetches, stale writes, unbounded realtime subscriptions and N+1 query patterns.
- Use pagination, lazy-loading, responsive image candidates, stable dimensions and thumbnail placeholders.
- Data-saving settings must affect real media requests. Avoid downloading every Explore video immediately.
- Keep animation within display capability; do not claim 120 FPS without measured hardware evidence.
- Large video requires resumable upload/transcoding/CDN architecture; document infrastructure prerequisites.

## 15. Web, Android and release

- Keep shared feature behavior and theme parity. Inspect `mobile-shell/app-mobile.css`, Java bridge, native permissions and CI source generation.
- Test WebView Back, keyboard, camera/microphone, notification permission, status bar, safe areas and install/update behavior.
- Stable package ID/signing key, version code/name, production APK/AAB, CI quality gate, release notes and rollback plan.
- Do not claim a debug APK is a production-signed Play Store release.
- Verify Vercel production aliases point to the intended GitHub main commit. A successful preview does not prove production is updated.
- Report build limits/auth/configuration blockers accurately and never say Deployed before checking the production commit.

## Phased implementation order

### Phase 1 — Baseline and reliability

Produce architecture/risk report and feature inventory. Preserve and ship already-reviewed call fixes. Fix delayed playback, media request waste, user-facing retries and account-scoped recent searches. Run the repository quality gate and focused behavior tests.

### Phase 2 — Core social completion

Audit feed/profile/comment/connection pagination and authorization. Implement missing server-backed search, topics, story replies/reactions and recommendation controls in bounded slices. Add appropriate migrations and policy tests. Verify each complete user flow with real accounts.

### Phase 3 — Communication and safety

Close remaining chat/voice/call regressions. Enforce call state transitions. Configure and verify TURN/FCM, privacy-aware push and Android lifecycle behavior. Test real devices, permission failures and offline recovery.

### Phase 4 — Release readiness

Authenticated mobile/light/dark visual matrix, accessibility, performance measurements, account lifecycle/moderation audit, production signing, store materials and closed beta. Repair failures before public launch.

## Review loop after every phase

Review architecture, functionality/edge cases, UI alignment, typography/icons, responsive/native parity, accessibility, auth/RLS/data exposure, performance/network behavior and regression. Fix findings before proceeding. Run `npm run verify` and relevant focused tests; avoid tests that merely mirror markup.

## Definition of done and reporting

A feature is done only when persisted behavior, authorized/denied paths, loading/error/empty/success states, mobile/theme behavior and regression evidence are verified. Report implemented changes, meaningful test results, GitHub commit/PR, actual production deployment status and material remaining gates. Keep planned work visibly separate from completed implementation.
