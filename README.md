# Leaflet

Leaflet is an iOS-first plant-care app built with Expo Router, Supabase, OpenAI, and RevenueCat. It helps houseplant owners identify plants, save a collection, track care, review plant-health guidance, manage reminders, unlock premium features, and receive weather-aware care tips.

## Product Surface

- Account access with Supabase email/password auth plus Apple and Google sign-in.
- First-run onboarding that moves new users into sign-in and their first scan.
- Plant scanning through the `identify-plant` Supabase Edge Function with OpenAI-powered identification.
- Species profiles with care guidance, toxicity notes, images, and scan alternates.
- A saved plant collection with editable nicknames, locations, placement details, and photos.
- Care schedules, quick logs, history, local reminder notifications, and care streaks.
- Diagnosis flows for plant-health photos with visible AI safety disclaimers.
- Premium entitlements through RevenueCat, including restore support and webhook-backed sync.
- Weather-aware care cards and alerts using coarse location or manual city input.

## Stack

- Expo SDK 54, Expo Router, React Native, TypeScript
- Supabase Auth, Postgres, Storage, and Edge Functions
- OpenAI vision/text models behind Supabase Edge Functions
- RevenueCat for subscription entitlements
- EAS for native iOS builds

## Environment

Copy `.env.example` to `.env` and fill in the public values used by the Expo client:

```powershell
Copy-Item .env.example .env
```

Required public variables:

```text
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=
EXPO_PUBLIC_REVENUECAT_IOS_KEY=
```

Secondary Android support uses:

```text
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=
```

Development-only email/password helpers are available through:

```text
EXPO_PUBLIC_DEV_TEST_EMAIL=
EXPO_PUBLIC_DEV_TEST_PASSWORD=
```

Only use public client keys in Expo environment variables. Keep service-role keys, OpenAI keys, Apple secrets, Google secrets, and RevenueCat webhook secrets in the relevant provider dashboards or Supabase secret management.

Server-side secrets required by the deployed Supabase functions include:

```text
OPENAI_API_KEY
REVENUECAT_WEBHOOK_SECRET
```

## Local Setup

Install dependencies:

```powershell
npm install
```

Start Expo:

```powershell
npm run start
```

Run TypeScript validation:

```powershell
npm run typecheck
```

## Production Build

Leaflet's primary release target is iOS. Confirm the external setup in `docs/phase-10-launch-blockers.md`, then create a production iOS build:

```powershell
eas build --platform ios --profile production
```

Use a development client for physical-device provider QA before submitting to App Store Connect:

```powershell
npm run build:dev:ios
```

Android remains secondary and is available for Google sign-in and RevenueCat checks:

```powershell
npm run build:dev:android
```

## External Setup

- Configure Supabase Auth for email/password, Apple, and Google providers.
- Apply the Supabase migrations in `supabase/migrations`.
- Deploy the `identify-plant`, `weather-tips`, and `revenuecat-webhook` Edge Functions.
- Set required Supabase Edge Function secrets for OpenAI and RevenueCat.
- Configure Apple Developer and Google Cloud OAuth settings for bundle ID `com.countrybean.leaflet`.
- Configure RevenueCat offerings, entitlements, products, App Store credentials, and webhook delivery.

Detailed provider guidance lives in `docs/auth-provider-setup.md` and launch setup blockers live in `docs/phase-10-launch-blockers.md`.

## Release Verification

- `npm run typecheck` passes.
- Fresh install opens onboarding and reaches sign-in.
- Email/password, Apple, and Google sign-in create or restore the expected Supabase user.
- A signed-in iPhone can scan, identify, save a plant, view species details, and return to the dashboard.
- Care tasks can be logged, reminder permission can be requested, and notification-tap routing is checked on device.
- Diagnosis results and saved diagnosis history show AI advisory copy.
- Weather-aware tips work with coarse location or manual city input.
- Premium purchase, restore, entitlement refresh, and RevenueCat webhook sync are verified with App Store sandbox tooling.
- Privacy Policy and Terms are reachable from sign-in and Profile.
- App Store screenshots, privacy labels, age rating, and support/legal URLs are ready in App Store Connect.
