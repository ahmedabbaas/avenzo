# AVENZO — Publish-Ready Mobile Product Checklist

This is the source-of-truth checklist for turning AVENZO into a production social app with an original product identity. The goal is Instagram-class completeness without copying Instagram's visual design.

Legend:
- ✅ implemented and retained
- 🛠 hardening/polish in the current publish-readiness program
- ⏭ planned before broad public launch
- 🚫 intentionally not copied; AVENZO uses its own interaction/design language

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
- ⏭ Profile pinning
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
- ⏭ Call history surface
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
