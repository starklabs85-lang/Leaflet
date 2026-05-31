# Phase 10 Launch Setup Blockers

These are external setup items, not app-code blockers.

## Supabase And AI

- Confirm `EXPO_PUBLIC_SUPABASE_URL=https://gnrjqqoidzuwzvhhfggh.supabase.co` and the matching public anon key are present in the local/EAS environment.
- Confirm the deployed `identify-plant` Edge Function is the current production version.
- Confirm `OPENAI_API_KEY` is set as a Supabase Edge Function secret for project `gnrjqqoidzuwzvhhfggh`.
- Verify real authenticated users can scan, save, read only their own plants, and upload/read only their own plant photos.

## Auth Providers

- Confirm Apple Sign in with Apple is enabled for bundle ID `com.countrybean.leaflet`.
- Confirm Supabase Auth Apple provider settings match the Apple Developer configuration.
- Confirm Google OAuth web and iOS clients are configured and match the Expo public env vars.
- Confirm the iOS URL scheme from Google Cloud is present in EAS/app config.

## EAS And Apple

- Log in to the correct Expo account in EAS CLI.
- Confirm Apple Developer team access for certificates, identifiers, and provisioning profiles.
- Create or verify the App Store Connect app record for `com.countrybean.leaflet`.
- Run `eas build --platform ios --profile production`.
- Submit or upload the build to TestFlight after it installs and launches locally.

## Physical Device QA

- Test on a physical iPhone with camera, photo library, notification permission, and real network changes.
- Validate Apple sign-in on iOS hardware.
- Validate notification delivery and notification-tap routing; this cannot be proven by TypeScript or simulator-only checks.
- Capture App Store screenshots from a production-like build after the core flow passes.

## Legal Hosting Decision

- Phase 10 includes in-app Privacy Policy and Terms content.
- Before public launch, decide whether to host the same content on a public URL for App Store review/support pages.
