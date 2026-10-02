# AVENZO — Publish-Ready Mobile Product Checklist

This is the source-of-truth checklist for turning AVENZO into a production social app with an original product identity. The goal is Instagram-class completeness without copying Instagram's visual design.

Legend:
- ✅ present in the existing code; this does **not** certify end-to-end or device verification
- 🛠 hardening/polish in the current publish-readiness program
- ⏭ planned before broad public launch
- 🚫 intentionally not copied; AVENZO uses its own interaction/design language

## Current engineering audit — 2026-10-02

Architecture: Next.js 16.3 / React 19 product UI, Supabase Auth/Postgres/RLS/Realtime,
Capacitor Android shell, and a Java WebView bridge. The central product CSS is
`app/avenzo-design-system.css`; native overrides are `mobile-shell/app-mobile.css`.
The Android CI workflow generates MainActivity, so native changes must be mirrored there.

### Release acceptance matrix

| Area | Required checks | Evidence / remaining gate |
| --- | --- | --- |
| Phone layout | 320, 360, 390, 430, 480 CSS px; portrait/landscape; no clipping | Responsive code present; full authenticated device matrix required |
| Media | Correct aspect ratio, high-DPI candidates, grid-sized requests, lazy decoding | Feed uses quality 90; grids now use 33vw candidates; original source limits sharpness |
| Themes | Light/dark/system across feed, profiles, chat, settings, composer, calls | Shared tokens and native parity; authenticated visual checks still required |
| Audio/video calls | Call, accept, decline, cancel, end; second incoming call; denied permission; network change | This phase fixes signalling concurrency, SDP restart, polling lifetime, zero-row accept and truthful connection status |
| Call audio | Bidirectional audio, muted remote video, user gesture recovery, native routing | Playback recovery implemented; two physical devices over Wi-Fi/mobile data required |
| Notifications | New/unread only; foreground, background, killed process | In-app/native polling exists; FCM killed-process delivery remains a launch gate |
| Auth/security | Login/reset/MFA, private/block rules, RLS, uploads, deletion | Preserve existing controls; security review and real-account regression required |
| Android release | Stable signing, version, APK/AAB install/update, back/keyboard/system bars | CI debug APK is installable but is not a Play Store production-signed AAB |
| Public launch | Privacy/data safety, moderation/support, store assets, closed beta | Must be completed before public release |

### Work order

1. Call reliability and lifecycle regressions.
2. Shared phone sizing, media delivery and light/dark readability.
3. Verify every existing feature below against real accounts; repair failures before expanding.
4. Add outstanding features with persistence, authorization and loading/error/empty states.
5. Physical-device beta, production TURN/FCM and store release gates.

No checkbox alone proves a feature works. A feature becomes release-verified only after its
happy path, denied/empty/offline path, mobile/light/dark layout, permission boundary and
regression checks pass. Do not add unused frameworks or inflate the APK to simulate quality.

## 1. Product shell and navigation

- ✅ Android APK built with Capacitor + native Java bridge
- ✅ Responsive web app
- ✅ Home / Discover / Create / Clips / Profile bottom navigation
- ✅ Shared navigation across main authenticated routes
- ✅ Bottom navigation hidden in Settings
- ✅ Bottom navigation hidden during Create/Upload
- ✅ Bottom navigation hidden during story viewer
- ✅ Keyboard-safe bottom navigation
- ✅ Android safe-area / gesture-bar handling
- ✅ Back navigation returns one level before exiting app
- ✅ Edge-to-edge Android status/navigation bars
- ✅ 60/90/120 Hz display preference when supported
- 🛠 Phone-first spacing, density and touch-target normalization
- 🛠 Unified visual scale for 360–480 px phone widths
- 🛠 High-DPI media rendering and image quality
- ⏭ Tablet / foldable adaptive navigation

## 2. Identity and design system

- ✅ AVENZO silver/graphite brand mark
- ✅ Dark mode
- ✅ Light mode
- ✅ System theme
- ✅ Theme persisted per account/device
- ✅ Typography hierarchy
- ✅ Loading, empty and error states
- ✅ Skeleton loading
- ✅ Reduced motion setting
- ✅ Larger text setting
- ✅ High contrast setting
- 🛠 Publish-ready Obsidian/Silver design tokens
- 🛠 Unified cards, sheets, inputs, buttons and dialogs
- 🛠 Consistent focus, pressed, disabled and loading states
- 🛠 Clearer media rendering on high-DPI phones
- ⏭ Per-chat wallpaper/theme presets using AVENZO originals

## 3. Authentication and account

- ✅ Sign up
- ✅ Login
- ✅ Email verification
- ✅ Session persistence
- ✅ Forgot/reset password
- ✅ Username validation
- ✅ Avatar upload
- ✅ Profile/account settings
- ✅ Privacy settings
- ✅ Blocked accounts
- ✅ Account safety controls
- ⏭ Passkeys
- ⏭ Optional 2FA
- ⏭ Device/session management
- ⏭ Account export/delete self-service flow

## 4. Home feed

- ✅ Real authenticated content only
- ✅ Following feed
- ✅ Suggested/For You feed
- ✅ Text posts
- ✅ Image posts
- ✅ Video posts
- ✅ Multi-image/carousel posts
- ✅ Likes
- ✅ Double-tap like
- ✅ Comments
- ✅ Replies
- ✅ Comment likes
- ✅ Saves
- ✅ Reposts
- ✅ Share
- ✅ Follow/unfollow from content
- ✅ Report post
- ✅ Edit own caption
- ✅ Delete own post
- ✅ Collaborators
- ✅ Poll posts
- ✅ Poll voting/change/remove
- 🛠 Mobile post density and readable action rail
- 🛠 Media aspect-ratio consistency
- ⏭ Feed ranking quality controls
- ⏭ Hide/not-interested feedback
- ⏭ Content recommendation explanations

## 5. Create and publishing

- ✅ Gallery upload
- ✅ Camera capture
- ✅ Multi-image selection
- ✅ Crop
- ✅ Rotate
- ✅ Filters
- ✅ Brightness
- ✅ Contrast
- ✅ Caption
- ✅ Hashtags
- ✅ Mentions
- ✅ Location
- ✅ Collaborators
- ✅ Alt text
- ✅ On-device Smart Alt
- ✅ Poll builder
- ✅ Upload progress
- ✅ Duplicate-submit prevention
- ✅ Persistent local drafts with media blobs
- ✅ Post / Clip / Moment creation modes
- 🛠 Full-screen mobile composer sizing
- 🛠 Publish button always reachable above keyboard/safe area
- ⏭ Scheduled publishing
- ⏭ Draft sync across devices
- ⏭ Background upload queue with resume

## 6. Moments / stories

- ✅ Image stories
- ✅ Video stories
- ✅ 24-hour expiry
- ✅ Seen/unseen
- ✅ Viewer progress
- ✅ Previous/next
- ✅ Tap navigation
- ✅ Swipe/close interactions
- ✅ Story views
- ✅ Viewer list for own stories
- ✅ Close Friends audience
- ✅ Archive
- ✅ Highlights
- 🛠 Viewer safe-area/full-screen polish
- ⏭ Story reactions
- ⏭ Story replies surfaced into DMs
- ⏭ Story polls/questions using original AVENZO UI

## 7. Clips / short video

- ✅ Vertical short-form video
- ✅ Autoplay
- ✅ Pause/play
- ✅ Mute/unmute
- ✅ Like
- ✅ Comment
- ✅ Share
- ✅ Save
- ✅ Repost
- ✅ Profile navigation
- ✅ Cover image
- ✅ View count
- ✅ Nearby-video preloading strategy
- ✅ Offscreen media pause
- 🛠 Full-screen phone viewport and controls
- 🛠 Network/data-saving behavior
- ⏭ Audio/music attribution framework
- ⏭ Remix/response clips
- ⏭ Clip drafts with richer editor timeline

## 8. Discover and search

- ✅ User search
- ✅ Post search
- ✅ Clip discovery
- ✅ Explore media grid
- ✅ User results
- ✅ Empty/no-result state
- ✅ Loading/error state
- 🛠 Mobile search header consistency
- ⏭ Hashtag/topic pages
- ⏭ Recent searches
- ⏭ Search suggestions
- ⏭ Safety-aware recommendation controls

## 9. Profiles and social graph

- ✅ Own profile
- ✅ Other-user profile
- ✅ Unified mobile profile design
- ✅ Bio
- ✅ Website
- ✅ Avatar
- ✅ Post/follower/following stats
- ✅ Follow/request/unfollow
- ✅ Private accounts
- ✅ Followers/following lists
- ✅ Remove/block/report controls
- ✅ Posts / Clips / Saved / Tagged tabs where appropriate
- ✅ Profile highlights
- ✅ Profile sharing
- ✅ Creator Insights
- 🛠 Same profile appearance from every entry point
- ✅ Profile pinning (up to three own posts; merged before this phase)
- ⏭ Profile category labels
- ⏭ QR/share card

## 10. Messaging

- ✅ Real users/conversations only
- ✅ Inbox
- ✅ Requests
- ✅ Primary/general folders
- ✅ Search users
- ✅ Search messages
- ✅ Text messages
- ✅ Image attachments
- ✅ Video attachments
- ✅ File attachments
- ✅ Voice messages
- ✅ Replies
- ✅ Reactions
- ✅ Edit message
- ✅ Delete for me
- ✅ Delete for everyone
- ✅ Seen/delivered state
- ✅ Typing indicator
- ✅ Online presence
- ✅ Pin conversation
- ✅ Pin message
- ✅ Mute conversation
- ✅ Chat themes
- ✅ Scheduled messages
- ✅ Groups
- ✅ Broadcast Channels
- ✅ Message safety/report/block/restrict
- 🛠 Phone full-height chat layout
- 🛠 Composer keyboard/safe-area behavior
- ⏭ Attachment gallery
- ⏭ Link previews
- ⏭ Search filters by media/link/file

## 11. Voice and video calls

- ✅ 1:1 audio call UI
- ✅ 1:1 video call UI
- ✅ Incoming/outgoing call sessions
- ✅ Accept/decline/end
- ✅ Microphone/camera WebView permission bridge
- ✅ Native Android audio routing
- ✅ WebRTC signalling through Supabase
- ✅ Missed-call timeout
- 🛠 TURN relay for mobile-network/NAT reliability
- 🛠 ICE recovery and reconnect
- 🛠 Speaker toggle
- 🛠 Camera toggle
- 🛠 Call duration and connection state
- 🛠 Keep-screen-awake during calls
- 🛠 Android call UI sizing
- ⏭ Bluetooth/headset route selector
- ⏭ Dedicated incoming-call foreground service / full-screen call notification
- ✅ Call history surface (merged before this phase)
- ⏭ Group calls

## 12. Notifications

- ✅ In-app social activity
- ✅ Likes
- ✅ Comments/replies
- ✅ Follows/requests
- ✅ Mentions
- ✅ Message notification plumbing
- ✅ Android notification permission
- ✅ Incoming-call background polling fallback
- ✅ Unread indicators
- 🛠 Separate notification categories/channels
- ⏭ FCM push delivery when app process is dead
- ⏭ Notification grouping
- ⏭ Per-conversation notification controls

## 13. Privacy, safety and security

- ✅ RLS-backed Supabase data access
- ✅ Private-account flow
- ✅ Block/report/restrict
- ✅ Message requests
- ✅ Content reporting
- ✅ CSP/security headers
- ✅ Camera/microphone Permissions-Policy
- ✅ HTTPS-only Android remote origin
- ✅ No service-role key in client
- 🛠 Call signalling hardening
- ⏭ Database call participant-ID immutability and permitted status transitions (current participant UPDATE policy needs stronger constraints)
- 🛠 Release permissions audit
- 🛠 Runtime error audit
- ⏭ Abuse-rate limits
- ⏭ Automated moderation queue
- ⏭ Safety center and appeals workflow

## 14. Media quality and performance

- ✅ Next.js Image for known-dimension media
- ✅ Stored media dimensions
- ✅ Video preload controls
- ✅ Data-saving preferences
- ✅ High-quality upload preference
- ✅ Lazy loading
- ✅ Android hardware acceleration
- 🛠 90-quality high-DPI image delivery for core social media
- 🛠 No WebView zoom/scaling blur
- 🛠 Mobile CSS density normalization
- 🛠 Reduced layout shifts
- 🛠 Call ICE candidate pooling
- ⏭ Resumable uploads for large video
- ⏭ Media transcoding ladder / adaptive video streaming
- ⏭ CDN cache policy audit

## 15. Release readiness

- ✅ Stable Android package id: com.avenzo.app
- ✅ Stable app icon/branding
- ✅ Manifest / PWA metadata
- ✅ CI quality gate
- ✅ CI Android APK build
- ✅ Production Vercel deployment
- 🛠 Mobile visual QA
- 🛠 Call reliability QA
- 🛠 Crash/runtime-error review
- ⏭ Play Store release AAB with production signing
- ⏭ Privacy policy/store data-safety review
- ⏭ Store screenshots
- ⏭ Versioning/release notes
- ⏭ Crash reporting and analytics consent
- ⏭ Closed beta before public rollout

## Engineering rule

Do not add fake users, fake activity, dummy buttons, dead screens, artificial APK padding, or unnecessary frameworks. Existing working behavior should be improved instead of blindly rebuilt. Every release-facing feature must have a loading/error/empty/success path and mobile-safe layout.

## Validation for mobile call hardening — 2026-10-02

- Repository contracts, ESLint, TypeScript and production build passed locally.
- 14 Deno unit tests passed, including ordered signal tasks, ended-call cancellation
  and recovery after a rejected task. Supabase Edge Functions type checks passed.
- Isolated Chromium harness rendered the actual CallManager with mocked signalling
  and transport. Passed: duplicate call taps, duplicate/concurrent signals, one peer,
  truthful connection status, mute track, ICE restart SDP, microphone cleanup, a
  second incoming call delivered by polling, expired-call acceptance and visible
  start failure, denied microphone access, and immediate microphone cleanup when
  the end-call network request fails. No uncaught browser errors.
- Call dialog checked at 320/360/390/430/480 CSS pixels in light and dark themes
  with native CSS loaded; no horizontal overflow and at least 48px touch targets.
- This is not a two-device WebRTC/audio test and does not verify production TURN,
  Bluetooth routing, killed-process notifications or Play Store readiness.
