# Fernly iOS Development Build QC — 2026-09-01

## Outcome

This candidate is an internal, physical-device development build for scan testing. It does not deploy Supabase code, replace the current production binary, upload to TestFlight, or submit anything to App Store review.

## Source provenance

- Branch: `codex/fernly-build30-icon-scan-fix`
- Application source commit: `d057454609877b3b9639fa72aa82ea82a4cf2d9f`
- Release-source baseline: `a89dec838ca145dfe073222b2420628725edbcb8`
- EAS project: `@starklabs2026s-team/leaflet`
- Bundle identifier: `com.countrybean.leaflet`
- Public app version: `1.0.2`

The archive was uploaded from a clean application source tree with EAS no-VCS packaging because the repository historically tracks 37,198 files under `node_modules`. The existing `.easignore` excluded that dependency tree. The only ignored build input was the EAS-provided Firebase plist file. No uncommitted application code was included.

## Build 30 icon proof

- Build 30 EAS ID: `80c97a35-3d08-4a2f-9abf-1b077ba061c0`
- Build 30 source commit: `7a93126be8b6e52bb9854d210e823cb71b9e8882`
- Build 30 creation date: 2026-07-29
- Build 30 icon SHA-256: `84133ffc80b9c77023e1e72c0bd61120ec5be9a27120c175935454d9428ae702`
- Candidate `assets/icon.png` SHA-256: `84133ffc80b9c77023e1e72c0bd61120ec5be9a27120c175935454d9428ae702`
- Both assets: 1024 × 1024 PNG

The candidate therefore uses the exact build 30 icon bytes; no logo redesign or asset substitution was required.

## Scan diagnosis

- The production `identify-plant` Edge Function was active at version 22 during diagnosis.
- An authenticated request using the existing QA account reached the function and returned the fixed response `premium_required`.
- The QA account had no active Premium server entitlement.
- Premium enforcement exists in both the client and Edge Function and was intentionally preserved.
- No subscription row was created or modified, and no paywall bypass was added.

This proves route reachability and authentication, but it is not proof of a completed Premium scan. Device acceptance testing must use an active Premium sandbox entitlement. A Free account is expected to see the paywall instead of running identification.

## Development configuration

The following required names were configured in the EAS `development` environment without recording their values:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`
- `GOOGLE_SERVICES_INFO_PLIST` (secret file, XML plist)

Existing development AppsFlyer variables were retained. Production EAS variables were not changed. Local `.env` files and Firebase plist files are ignored and excluded from Git.

Build validation now fails before native compilation when required client configuration is missing, the Firebase plist is missing, the plist uses binary format, or a production profile contains development-login credentials.

## Fresh verification

- Focused application tests: 87 passed, 0 failed
- Production-ops tests: 42 passed, 0 failed
- Build-configuration tests: 5 passed, 0 failed
- Analytics manifest check: passed
- TypeScript `tsc --noEmit`: passed
- Expo public config: correct app name, version, bundle identifier, build 30 icon path, Firebase file presence, Supabase presence, Google iOS client presence, and EAS project ID
- Camera pre-permission CTA regression: passed (`Continue`/neutral action contract)

## EAS development build

- Build ID: `51f7a20a-cc29-40c3-9d8f-a4df17c6a0f6`
- Profile: `development-device`
- Platform: iOS
- Distribution: internal/ad hoc
- Version/build: `1.0.2 (40)`
- Status: finished successfully at 2026-09-01 13:18:25 UTC
- Install URL: `https://expo.dev/artifacts/eas/561Rv5C8o5OXZHmAPWjGF6chfN6oPcGo8lqaxBw3WTw.ipa`
- Device scope: the existing registered iPad in the active provisioning profile

## Device acceptance check

1. Install the internal development build on the registered iPad.
2. Start the Expo development server for this branch and connect the development client.
3. Sign in with an account that has an active Premium sandbox entitlement.
4. Open the scan flow and confirm the camera pre-permission action uses the neutral `Continue` wording.
5. Grant camera access, capture a plant image, and confirm the identification request completes.
6. Repeat with a Free account and confirm the paywall appears instead of identification.

No production deployment or store submission is authorized from this QC artifact.
