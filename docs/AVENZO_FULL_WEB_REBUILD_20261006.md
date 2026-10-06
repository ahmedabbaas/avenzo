# Full web rebuild: light mode and every product surface

## Architecture and risk audit before changes

Main baseline: 02e0d3c77684a547f9c4f42e492ee0bdab3a999c. Existing
Next/React routes and Supabase Auth/RLS/data/mutations stay intact. The user
explicitly requires the whole web, not just Create. Native app shares these
surfaces; preserve bridge and native lifecycle code.

CSS has three historical web sources plus native compatibility, repeatedly
redefining themes with fixed white text/dark surfaces and important declarations.
Layering native CSS alone does not solve it: important declarations in a layer
outrank unlayered important declarations. Establish normal-priority compatibility
layers and retain canonical product styles above them. Keep old geometry as
fallback, not a competing visual authority. The regression risk is broad layout
priority, so review each major route and run quality gates before deployment.

Profile contains multiple separately rendered desktop/mobile headers. Own grid
navigation does nothing on web because its handler returns unless Android.
Messages canonical styling targets `.dm-conversation-row` while the actual
component uses `.dm-conversation`; these controls keep older styling.
Discover filters are hidden on desktop, despite working filtering logic.
Clips page has a forced dark background even in light mode. Login status uses
tiny text on a black strip in light mode. Settings and empty states still show
letter A rather than shared original logo. Preferences store arbitrary parsed
values without type validation; data-saving autoplay needs explicit control.

## Fresh reference extraction

Seven large standalone generated references: Home, Profile, Discover, Messages,
Clips, Appearance and Login. These are design references only; no illustrative
people, posts, counts or extra navigation/features become product data.

Home: light outer canvas, white flat post surface, about 220px sidebar, readable
32px heading, restrained underline feed tabs, circular Moments, 600px feed.
Profile: single avatar/identity/bio header, equal three-column stats, 44px action
buttons, square media grid with consistent gaps. Reuse one header on own/public.
Discover: full-width 52px search, underline category tabs, compact identity rows,
square media. Messages: two panes, 80px rows, readable 14px preview/metadata,
white composer/input and clear selected conversation, no nested panels.
Clips: light page chrome, one 9:16 dark video with white overlay controls.
Appearance: clearly labeled Light/Dark/System previews, readable settings rows,
separated groups and reachable Save. Login: centered 420px form, 36px title,
56px fields, 16px body, graphite button, visible error feedback.

Shared palette: #f6f7f9 canvas / #ffffff surface / #17202b main text /
#596574 muted text / #dce2e8 border. Dark equivalents use the same geometry.
Existing original rounded PNG stays unchanged. Font uses bundled Jakarta first,
then platform sans. Reduced motion, larger text and high contrast remain.

## Implementation coverage and verification gates

Cover Home/post actions/Moments, Discover/search, own/public profile/grid/tabs,
saved/tagged/collections, Clips/playback, inbox/chat/groups/channels/calls,
activity/comments, account/login/signup/reset, Settings/appearance/connections,
loading/empty/error sheets and shared Create.

Functional additions: web profile grid opens posts via keyboard/native links;
Discover categories available on desktop; explicit privacy-aware search remains;
validated preference parsing and data-saving playback behavior; preference
reset for device-local accent. Preserve actual publishing, messaging, follow,
permissions and media pipelines. Do not publish test content or send fake messages.

Check CSS parsing and text contrast, local full verify, deployed authenticated
flows when signed-in session is available, theme switches and all major routes.
Physical Android/two-device calling/push cannot be claimed without those devices.

## Validation and implementation record
- Shared ProfileHeader replaces duplicated own/public profile layouts; web media tiles are real links, native deep links remain conditional.
- Every compatibility CSS layer uses normal declarations so the canonical design system controls both themes. Fixed a pre-existing unclosed 620px media query that swallowed subsequent global rules.
- Added unread conversation filtering, visible desktop discovery categories, accent reset, robust preference validation/storage updates and manual Clip playback when data saver is on.
- Light primary, secondary, muted text and optional accent text pass WCAG 4.5:1 assertions against actual theme surfaces. CSS parsing and layer priority assertions are part of verify.
- Secondary surfaces covered: Activity, Saved collections, followers/following, Groups and Channels. Existing server mutations and private account guards preserved.
- Physical Android, two-device calls and push delivery require separate device verification; no such claims are made by this web rebuild.
