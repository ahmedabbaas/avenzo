# AVENZO stability implementation prompt

Inspect the existing Next.js web app, Capacitor Android shell, components,
network requests, styles, navigation and tests before editing. Preserve the
approved social layout and Obsidian Chrome identity. Improve working features
instead of rebuilding them. Use real account data and working actions only.

Audit feed, profile, discovery, posts, stories, reels, messaging, calls, upload
and authentication for reproducible failures. Prioritize duplicate writes,
request races, stale responses, failed optimistic updates, unhandled promise
rejections, missing loading/error/empty states, timer/listener cleanup, media
controller lifecycle, keyboard/safe-area issues and back/scroll restoration.

Implement focused fixes in phases. Preserve authorization, privacy and RLS;
do not expose secrets or change data permissions to silence an error. Make
retry behavior explicit and avoid replaying uncertain non-idempotent writes.
Keep independent actions responsive while preventing concurrent writes for
the same item. Cancel scheduled background work when its screen unmounts.

After each phase review functionality, mobile/web parity, UI, typography,
accessibility, security, performance and regressions. Add meaningful tests for
failure recovery and concurrency, then run npm run verify. Push reviewed
changes to GitHub, deploy production, and verify the intended commit plus
public assets. Report exactly what was changed and tested; explicitly identify
device, two-account or network scenarios that were not verified. Do not claim
the entire application is stable merely because the build passed.
