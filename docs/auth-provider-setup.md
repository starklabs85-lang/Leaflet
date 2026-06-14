# Phase 02 Auth Provider Setup

Phase 02 supports Supabase email/password auth plus native Apple and Google identity tokens exchanged with Supabase Auth via `signInWithIdToken`.

## Supabase

Enable or review these providers in the Supabase dashboard:

- Email
- Apple
- Google

Configure redirect/deep-link URLs for the app scheme:

```text
leaflet://
```

The Expo app must only use the public Supabase URL and anon key. Keep service-role keys and provider secrets in dashboards or operator-managed config only.

Hosted Supabase projects commonly require email confirmation for new email/password users unless confirmation is disabled in the dashboard. Leaflet supports both settings: confirmation-disabled sign-up returns a session and routes into the app, while confirmation-enabled sign-up leaves the user on sign-in with a check-your-email message.

## Email/password

Email/password sign-up and sign-in use the existing public Supabase URL and anon key. No additional Expo environment variables are required.

Before release, verify:

- New email/password account creation is allowed for the project.
- The email confirmation setting matches the launch policy.
- Confirmation email templates and SMTP settings are production-ready if confirmation stays enabled.
- Existing OAuth users can still use Apple or Google without changing their sign-in path.

## Apple

Apple sign-in requires:

- Apple Developer account.
- App ID matching `com.countrybean.leaflet`.
- Sign in with Apple capability enabled.
- Supabase Apple provider configured with the Apple credentials required by Supabase.

Apple sign-in only appears on supported iOS devices.

## Google

Google sign-in requires Google Cloud OAuth clients:

- Web client ID, exposed to Expo as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
- iOS client ID, exposed to Expo as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
- iOS URL scheme, exposed to Expo as `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`.
- Android OAuth client using package name `com.countrybean.leaflet` and the signing certificate SHA-1 for the development build.

The web client ID is required for the native package to return the ID token Supabase needs.
The iOS URL scheme is the reversed iOS client ID form, for example `com.googleusercontent.apps.xxxxx`.
Android does not use the iOS URL scheme, but Google Cloud must know the Android package name and signing certificate SHA-1 for the native Google flow to succeed.

## Local env

Copy `.env.example` to `.env` and fill in:

```text
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=
```

## Runtime note

Native Apple and Google modules require a development build. Expo Go is not enough for full Phase 02 verification.

Phase 02 is not complete until all of these are true:

- `.env` contains the Supabase and Google public client values.
- Supabase Auth allows email/password sign-up and sign-in.
- Supabase Auth has Apple and Google enabled.
- Email confirmation behavior has been verified for the hosted project.
- Apple Developer has Sign in with Apple enabled for `com.countrybean.leaflet`.
- Google Cloud OAuth has clients matching the app bundle/package identifiers.
- A native development build signs in with both providers and shows new users in Supabase Auth.

Use the development profile in `eas.json`:

```powershell
npm run build:dev:ios
```

For Android provider testing:

```powershell
npm run build:dev:android
```

For local simulator testing after native credentials are configured:

```powershell
npm run ios
```

## Completion checklist

Use this checklist before starting Phase 03:

- `npm run typecheck` passes.
- `npm run start` starts Metro without config errors.
- Development build installs on the target device or simulator.
- Signed-out launch lands on the public sign-in screen.
- Email/password sign-up either creates a session or shows a confirmation-required message, depending on Supabase settings.
- Email/password sign-in restores a valid existing user session.
- Apple sign-in completes and creates a user in Supabase Auth.
- Google sign-in completes and creates a user in Supabase Auth.
- Relaunch restores the Supabase session.
- Profile sign-out clears the session and returns to sign-in.
- No database tables, scan flows, plant collection flows, or care scheduling have been added.
