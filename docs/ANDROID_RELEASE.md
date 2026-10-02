# AVENZO Android Release Guide

AVENZO has two intentionally separate Android pipelines:

1. **Debug/installable APK** for testing and owner distribution.
2. **Signed release APK + AAB** for store release candidates.

The debug certificate must never be treated as the Play Store production certificate.

## Build architecture

- Package ID: `com.avenzo.app`
- Minimum SDK: 24
- Compile SDK: 36
- Target SDK: 36
- Phone ABIs: `arm64-v8a`, `armeabi-v7a`
- Capacitor web source: `mobile-shell`
- Native Android source of truth: tracked files under `android/`
- Release builds use R8 code minification and Android resource shrinking.

## Debug APK

Workflow: `.github/workflows/android-apk.yml`

Runs automatically when relevant files reach `main`, and can also be run manually.

It:
- uses the stable AVENZO debug certificate already configured for testing,
- runs Capacitor sync,
- copies the native AVENZO CSS/JS bridge assets,
- builds `assembleDebug`,
- verifies the APK signature,
- uploads `AVENZO.apk` plus its SHA-256 file.

This APK is for testing/installing. It is not the Play Store signing identity.

## Release validation on pull requests

Workflow: `.github/workflows/android-release-check.yml`

It does not require signing secrets. It builds:
- a minified release APK, and
- a release AAB,

so R8/resource-shrinking/native bridge failures are caught before merge.

The output is deliberately unsigned and is not a distributable production release.

## Signed release APK + AAB

Workflow: `.github/workflows/android-release.yml`

It runs manually or on a `v*` tag and requires these GitHub Actions secrets:

- `AVENZO_ANDROID_KEYSTORE_BASE64`
- `AVENZO_ANDROID_KEYSTORE_PASSWORD`
- `AVENZO_ANDROID_KEY_ALIAS`
- `AVENZO_ANDROID_KEY_PASSWORD`

The keystore must be the permanent AVENZO release/upload key. Back it up offline. Losing a signing key without a recovery path can block future updates.

### Keystore secret format

Encode the binary keystore as one-line base64 before storing it in GitHub Actions:

```bash
base64 -w 0 avenzo-release.jks
```

On platforms where `-w` is unavailable:

```bash
base64 avenzo-release.jks | tr -d '\n'
```

Store the resulting text only in the GitHub secret. Never commit the keystore or passwords.

## Release workflow output

A successful signed release produces:

- `AVENZO-release.apk` — signed installable release build
- `AVENZO-release.aab` — signed Play Store bundle
- `AVENZO-release-sha256.txt` — SHA-256 checksums

The workflow verifies the APK signature with `apksigner` and verifies the AAB signature before uploading artifacts.

## Play Store path

Before public release:

1. Create the app in Google Play Console with package `com.avenzo.app`.
2. Use Play App Signing.
3. Register the AVENZO release/upload certificate.
4. Upload the generated `AVENZO-release.aab` to an internal or closed testing track first.
5. Complete Data safety, privacy policy, content rating, target audience, app access, ads declaration, and store listing.
6. Run real-device regression tests for authentication, media uploads, calls, notifications, background/resume, deep links, light/dark themes, and account safety.
7. Promote only the same tested artifact through release tracks.

## Release rule

Never artificially increase APK size. AVENZO package size must come from real application code, native models, assets and dependencies. Size is not a quality metric; working features and predictable release behavior are.
