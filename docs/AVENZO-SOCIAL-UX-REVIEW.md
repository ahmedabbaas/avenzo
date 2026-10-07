# AVENZO social usability release — 2026-10-07

## Architecture and scope

The existing Next.js client shell switches Home/Profile screens and renders shared PostCard and ProfileHeader components. Messaging uses its existing workspace and Supabase permissions. Android loads the production web application and injects a layered compatibility stylesheet. This release improves those components; it adds no new service, schema, permission or dependency.

## Visual extraction

The generated profile reference places an 88px avatar beside three equally sized stat columns, followed by a full-width identity/bio block, clear Edit/Share actions, a quieter Insights action, flat dividers, monochrome icons and honest empty states. The implementation uses the existing Obsidian Chrome tokens and 20px mobile gutters. Existing real profile data, highlight controls, tabs and creation actions are preserved. A completion suggestion appears only when the user's avatar or bio is missing; the sample reference bio is never inserted into an account.

## Implemented behavior

- Mobile profile: avatar/stats row, name/username/bio below, reorganized actions, completion suggestion, camera/reel empty states. Square grid thumbnails retain existing routes; video/carousel badges and real engagement counts appear on hover/focus.
- Share profile: pending feedback and synchronous duplicate guard, cancellation handling, timer cleanup.
- Home: Following/Discover selector restored in Android, visible refresh control with duplicate guard, one story avatar per author opening their earliest unseen story, mobile caption names/story labels no longer blocked by inline hiding.
- Comments: async submit contract, pending feedback, duplicate guard, retryable failure text and retained draft. A successful insertion followed by a failed reload stays successful to prevent duplicate retry writes.
- Inbox: All/Unread filters with real folder/count information, clear-search action, Escape-to-clear, result summary and accurate no-result copy, clear-filters action, visible usernames.
- Feed videos: observe visibility before autoplay, pause offscreen/background, cancel delayed playback on cleanup, preserve manual pause intent, respect data saving, provide load-failure Retry.

## Review and validation

Reviewed hook order/cleanup, keyboard controls, button labels and pressed/busy states, 320px profile sizing, canonical CSS/layer precedence, light/dark tokens and reduced motion. Mutations still go through existing Supabase functions and RLS. No privileged keys or fake engagement added. No new network queries or runtime dependencies added. Story grouping is linear grouping plus sorting within each author; viewport observers are cleaned up on unmount.

Automated tests exercise the actual PostCard submit/carousel handlers, commit-success/reload-failure boundary, deduplicated story tray, video visibility/cleanup, plus the full repository npm run verify gate. Actual phone layout, signed-in screenshots, real account writes and two-device messaging require an authenticated test session and were not verified in this release. The cloud browser reached the production login screen; this is not evidence of signed-in feature verification.
