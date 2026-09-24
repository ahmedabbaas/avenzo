# AVENZO Mobile App Master Build Specification

## Mission

Turn AVENZO into a production-grade, Android-first social platform with the interaction quality expected from modern social apps. The product may use a hybrid/native architecture, and APK size is not a constraint. Prefer reliability, native behavior, media quality, smoothness, privacy, and maintainability over minimizing binary size.

AVENZO must keep its own identity, logo, lime accent system, typography, product naming, and interaction details. Use Instagram-class product patterns only as UX references. Do not clone copyrighted branding, layouts pixel-for-pixel, proprietary icons, copy, or fake content.

## Non-negotiable product rules

1. Never generate fake users, posts, comments, stories, reels, messages, views, likes, follows, calls, notifications, or activity for production UI.
2. Every visible social object must come from a real authenticated account or an explicit empty/loading state.
3. Posts are image-first. Reels are video-first. Stories may contain supported photo/video media.
4. All user-generated content must be persisted in Supabase and protected by RLS.
5. Mobile Android is the primary UX target. Desktop web remains supported and must not regress.
6. Android hardware/gesture back must close the current transient layer before navigating away.
7. Root Home is the only place where back may minimize the app, with double-back confirmation.
8. No critical feature may depend on absolute pixel placement that breaks across phones.
9. Respect status bar, camera cutout, keyboard, and gesture-navigation safe areas.
10. Touch targets should be at least 48dp where practical.
11. High-refresh displays should be supported without forcing unsupported devices.
12. Preserve user state such as feed position, active tab, draft text, and open conversation when reasonable.
13. Light and dark themes must both remain usable.
14. Accessibility labels, focus behavior, contrast, motion preferences, and readable text sizes must be considered.
15. No production claim is complete until lint, typecheck, tests, production build, and Android APK build pass.

## App architecture

Use the existing Next.js + React + Supabase product as the product backend/web layer. Build the Android application with Capacitor/native Android integrations where required. Move platform-specific behavior behind a stable native bridge instead of scattering raw Android calls through product components.

Native capabilities should include:
- Android back dispatcher
- notification channels
- push notification integration
- deep links
- camera and gallery access
- microphone recording
- audio focus
- calls
- share sheet
- clipboard
- haptics
- status/navigation bar control
- splash screen
- keyboard resize
- app lifecycle/background state
- network state
- permissions
- file downloads/uploads

Use WebRTC for real-time calls. Use Supabase Realtime for application signaling/presence where appropriate. Production calling must support a TURN service in addition to STUN.

Use FCM for production push notifications so messages/calls can notify users even when the application process is not running. Do not rely on polling as the final push architecture.

## Navigation

Primary bottom navigation:
- Home
- Reels
- Messages
- Search
- Profile

Create is available prominently from the top bar and contextual entry points.

Secondary destinations:
- Activity
- Saved
- Settings
- Archive
- Close Friends
- Your activity
- Account/privacy tools

On Android:
- back from modal -> close modal
- back from Story viewer -> close Story viewer
- back from media viewer -> close viewer
- back from message action sheet -> close sheet
- back from active chat -> conversation list
- back from Settings subsection -> Settings root or originating screen
- back from Reels/Profile/Search/Messages -> previous valid app screen or Home
- back on Home -> show "Press back again to exit"
- second back within timeout -> move app to background

## Home Feed

Mobile Home should include:
- centered AVENZO identity in the top bar
- create button
- activity entry
- horizontally scrollable Stories
- real feed posts only
- edge-to-edge media
- like/comment/share/save actions
- captions below actions
- verified badge support
- follow state
- location, tags, mentions
- carousel support
- double-tap like
- long-press/context actions
- reporting
- mute suggested content/account controls
- skeleton loading
- empty feed state with useful real actions
- pagination/infinite loading
- feed scroll restoration

Ranking should eventually support Following and For You modes without fabricating engagement.

## Stories

Implement:
- photo/video stories
- 24-hour expiration
- viewer list for owner
- seen state
- story progress
- pause/resume
- tap left/right
- swipe down/back to close
- reply to story
- reaction to story
- mentions
- close-friends stories
- story mute
- story delete
- story archive
- Story Highlights on profiles

## Reels

Implement:
- vertical full-screen pager
- autoplay current reel only
- pause/resume
- preloading
- view counting using real viewers
- likes
- comments
- shares
- saves
- follow
- captions
- hashtags/mentions/location
- audio metadata
- cover image
- profile reel grid
- reporting
- not-interested controls
- smooth 60/90/120Hz-friendly rendering

## Explore and Search

Support:
- user search
- username search
- content search
- hashtag search
- suggested accounts
- media discovery grid
- recent searches
- clear history
- no fake suggestions
- empty states

## Profiles

Support:
- avatar
- display name
- username
- verification badge
- bio
- links
- post/reel/tagged tabs
- followers/following
- public/private account modes
- follow requests
- follow/unfollow
- message button
- call availability
- Story Highlights
- edit profile
- account actions
- block/restrict/report/mute

## Notes

Implement real 24-hour Notes:
- one active Note per user
- maximum short-text length
- audience controls
- notes row in Messages
- own note create/edit/delete
- tap another user's note to start/reply in DM
- automatic expiration
- no generated notes

## Messaging

Inbox:
- Primary
- General
- Requests
- search
- filters
- unread indicators
- muted indicators
- online status where allowed
- Notes row
- real conversations only

Conversation:
- text
- emoji
- image
- video
- files
- voice messages
- shared posts/reels/profiles
- reply
- reactions
- edit own text
- delete for me
- delete for everyone
- copy
- report
- read receipts
- delivery status
- typing indicator
- online status
- search conversation
- conversation themes
- mute
- restrict
- block
- delete conversation
- swipe to reply
- long-press action sheet

Add group conversations with:
- title/avatar
- member management
- admins
- leave/remove member
- group call foundation

## Calls

Audio calls:
- call button in DM
- ringing screen
- incoming call UI
- accept/decline/end
- mute
- speaker control
- call duration
- missed/declined history
- native audio focus
- microphone permission
- FCM incoming-call push
- WebRTC
- STUN + TURN

Video calls:
- camera permission
- front/back camera switch
- camera off
- microphone mute
- speaker
- picture-in-picture where appropriate
- connection recovery

Never claim production-grade calls until TURN and killed-app incoming call delivery are configured.

## Notifications

Use FCM for:
- new DM
- message request
- message reply
- incoming call
- missed call
- follow request
- accepted follow request
- follow
- like
- comment
- mention
- tag
- Story reply/reaction

Notifications must deep-link to the correct destination. Respect user notification settings and muted conversations.

## Create and Upload

Unified composer:
- Post
- Reel
- Story

Features:
- camera
- gallery
- crop
- rotate
- multi-select/carousel
- caption
- hashtags
- mentions
- location
- alt text
- high-quality upload
- progress
- retry
- drafts
- media preview
- compression/transcoding where needed
- cover selection for Reels

## Saved and Collections

Implement:
- save/unsave
- default Saved
- custom private collections
- add/remove post/reel
- create/rename/delete collection
- collection thumbnails
- no public exposure unless explicitly designed later

## Close Friends

Implement:
- private Close Friends list
- add/remove users
- use it for Story/Note audiences
- never expose membership publicly

## Privacy and Safety

Support:
- private accounts
- follow requests
- block
- restrict
- mute
- message permissions
- request permissions
- online-status toggle
- read-receipt preference if product chooses
- story controls
- comment controls
- mention/tag controls
- report flows
- account deactivation/deletion
- blocked account management

All policies must be enforced server-side/RLS, not only hidden in UI.

## Activity

Real activity only:
- follows
- follow requests
- likes
- comments
- mentions
- tags
- story replies/reactions
- message-related alerts
- system/security events where appropriate

## Creator/Professional Features

Future-ready:
- professional profile mode
- insights
- account/content reach
- reel/post performance
- profile visits
- audience metrics
- branded-content controls

Do not fabricate analytics.

## Performance

- avoid giant rerender loops
- lazy-load media
- use responsive images
- preload only nearby Reel media
- suspend off-screen video
- keep animations compositor-friendly
- avoid expensive blur layers during scroll
- cache stable queries appropriately
- restore scroll state
- handle bad network gracefully
- use optimistic UI carefully
- retry failed media uploads
- monitor memory use

Do not advertise a guaranteed FPS. Optimize for the device's actual supported refresh rate.

## Android quality bar

- adaptive launcher icon
- AVENZO splash
- notification icon/channel
- microphone/camera/media permissions
- edge-to-edge safe layout
- keyboard-safe composer
- native back handling
- haptics
- share sheet
- deep links
- proper versioning/signing
- release APK/AAB pipeline
- Play Store-ready release signing later

## Data and migrations

Every new feature must include:
- schema
- indexes
- foreign keys
- RLS
- grants
- realtime publication only where needed
- migration checked into the repo
- rollback-safe testing where practical

## Release workflow

For every milestone:
1. implement
2. lint
3. typecheck
4. tests
5. production Next.js build
6. database security advisor check for new schema
7. Android APK build
8. verify production deployment when hosting quota allows
9. never claim live until verified

## Phased implementation order

Phase 1: Core mobile shell, navigation, Home, Stories, Profile, search, real content.
Phase 2: DM polish, Notes, requests, typing, reactions, voice notes, themes.
Phase 3: Native notifications, FCM, audio/video calls, deep links.
Phase 4: private accounts, follow requests, Close Friends, collections, archive.
Phase 5: carousel posts, Story Highlights, tagged posts, group chats.
Phase 6: creator tools, insights, advanced moderation, reliability/performance pass.
Phase 7: release signing, AAB, Play Store readiness, crash/analytics monitoring.

This document is the source of truth. Existing working features should be preserved unless a migration explicitly replaces them.
