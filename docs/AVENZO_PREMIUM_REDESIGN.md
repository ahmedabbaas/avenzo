# AVENZO premium mobile redesign — 2026-10-05

## Architecture and risks before implementation

- Preserve Next.js/React routes, Supabase/RLS data operations and Capacitor/Java.
- Current web has several visual compatibility generations; native CSS has over
  17,000 lines of repeated theme rules. Android-specific high-priority overrides
  can obscure shared light/dark styling and recreate old layouts.
- The new visual authority stays in `app/avenzo-design-system.css`. A scoped
  premium root class controls the final shared design. Native CSS must stop
  overriding product design and retain platform-specific safe-area/bridge behavior.
- Authentication, account controls, upload persistence, permissions and social
  features are extended in place, not replaced.
- Exact uploaded RGBA rounded logo is authoritative. Preserve alpha and original
  silhouette; web/native render it without an extra tile, filter or square backing.
- Generated login/feed/chat references define typography, spacing and hierarchy;
  their invented content must not enter production data.

## Visual structure

- Login: quiet open layout, prominent original logo, welcome heading, 16px form
  fields, guest light/dark switch, existing MFA and password-reset behavior.
- Home: clearer header, underline feed switch, circular Moments, flat post layout,
  edge-to-edge media, consistent actions and one shared bottom dock.
- Discover: stronger title/search, recent searches, clean grid and lazy previews.
- Clips: cinematic full-height viewport, readable overlays, controlled playback.
- Profile: avatar/name/bio grouping, balanced stats, simple owner actions, grid.
- Inbox/chat: calmer rows, clear unread status, graphite/ivory bubbles, fixed
  keyboard-safe composer and original attachment controls.
- Settings: grouped preference rows, clear switches, theme and device appearance.
- Create: full-height focus-managed wizard, tab dock hidden, sticky header/footer,
  safe-area and keyboard-aware viewport, existing draft/edit tools preserved.

## Real additions and delivery

- Device-local accent finish selection and guest theme controls.
- Modal scroll/focus/Escape lifecycle and guarded navigation during uploads.
- Offline Android text extraction from selected images, with user-selected Latin,
  Chinese, Devanagari, Japanese and Korean recognizers. Extracted text is reviewed
  before copying into caption; supported scripts are explicit (no Urdu OCR claim).
- Preserve bundled Smart Alt and face detection. Only real used models/assets
  belong in the APK. Measure actual binary size; do not add filler to force 100 MB.
- Android launcher, splash, web manifest/icons and injected branding use one asset.
- Repository quality gate, focused regressions, live health, CI APK build,
  certificate/icon/manifest/size inspection and explicit unverified device gates.

## Offline Portrait Studio phase

Extend the existing composer replacement callback and native bridge; preserve uploads,
auth, RLS and original media until the user applies a preview. Bundle accurate pose,
selfie segmentation and barcode models, each reachable through the editor. Android
runs one image job on a separate worker, bounded to 2048 pixels and 12 MB transport;
models and bitmaps close after every job. UI ignores stale responses, exposes errors,
retains one undo while the editor is open, and never opens scanned links automatically.
Web retains its manual editor. Risks: portrait models are beta, hair/multiple people
can yield imperfect results; previews and undo are required. No physical-device
inference claim without a device test. APK size is measured after signing, not padded.

Phase review: preserved existing replacement/upload flow; 44px controls and named
preview/status fit the editor grid in both themes. Generation guards discard stale
callbacks; Studio processing blocks wizard navigation and closing. QR output is plain
text with explicit copy, never navigation. Inputs, output size, callbacks and worker
concurrency are bounded; no permissions/database/network additions. Geometry/alpha
unit tests and bridge failure/timeout checks cover boundary behavior. Actual portrait
quality and low-memory device behavior still need physical-device verification.

Native lifecycle review: activity destruction stops accepting new jobs but lets
active inference finish before closing its model and recycling its bitmap. The web
request retains a 45-second timeout and removes its callback; late results cannot
apply an edit. This avoids recycling native input while a slow model is reading it.

## Android layout recovery

The APK still injects 17,000 lines of legacy unlayered CSS after the web stylesheet.
Removing `!important` did not establish shared ownership: high-specificity native
selectors still override unprotected geometry, including square-cropped feed media.
Native profile enhancement also intercepts the current Settings control as Back;
fallback navigation lacks the current item classes. Recover by placing compatibility
CSS in a lower-priority cascade layer, preserving standalone native helpers, keeping
modern profile controls under React ownership, and correcting shared media/bubble
geometry. No auth, data, model or upload changes. Risk: custom legacy overlay controls
must retain their styles; authenticated visual verification requires a signed-in
session and physical-device confirmation remains necessary.
