# Editorial social finish

Superseded: the user rejected this structural redesign. The familiar pre-editorial layout is restored; future changes must enhance that layout incrementally. Live search and primary-screen scroll fixes are retained.

## Direction and architecture

Previous production inspection found repetitive account summaries, boxed right-rail shortcuts, a clipped Add moment label, and saturated stored accent finishes. The reference direction uses editorial headings, graphite/silver surfaces, hairline boundaries, a restrained navigation rail and spacious media presentation. Generated Home, Profile and Messages references guide hierarchy and spacing; reference people/photos/counts are not product data.

Reuse HomeClient, ProfileHeader, MessagesWorkspace and the canonical stylesheet. No database, auth, RLS, call signaling, upload or content mutations change. Existing finish IDs stay compatible with persisted preferences but their swatches become Silver, Slate and Warm. Android is a Capacitor shell loading production; canonical important rules continue to supersede its layered compatibility CSS.

## Implementation review

- Home adds a responsive editorial introduction, Moments section actions and a real composer shortcut. Duplicate right-rail account stats are removed; all Spaces destinations remain as flat rows.
- Navigation has a desktop wordmark, quieter selection, account identity below destinations and a distinct create action. At 901–1199px the secondary rail hides; at <=900px the mobile composition and existing navigation remain.
- Feed retains actual post components/actions, places media against a flat canvas and gives avatars, captions and boundaries consistent spacing. Moment item width protects its label.
- Shared own/public profile has a larger identity block, full-width equal stat columns and 48px actions. Narrow screens reduce avatar/text sizes without changing media routing.
- Messages uses editorial title/empty-state headings, generous conversation rows, neutral active selection and consistent composer spacing. Existing send/media/call features are preserved.
- Discover, Settings and Create share the heading system; body copy stays sans-serif. Light/dark token contrast, reduced motion, large text and high contrast remain supported.

## Verification limits

Run full npm run verify plus git diff --check before release. Signed-in desktop production review is required after release. The cloud browser cannot force a real phone viewport through its exposed controls; installed Android visuals, keyboard/safe-area behavior and real two-device calls still require device checks. Do not claim 4K assets, increased resolution, fixed frame rates, or end-to-end call verification.
