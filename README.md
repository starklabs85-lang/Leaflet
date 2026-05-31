# Leaflet

Leaflet is an Expo Router app scaffold for the plant-care product described in `PRD/`.

This repository currently implements the Phase 01 foundation, the Phase 02 app-side authentication shell, and the Phase 03 backend foundation files. Provider dashboard setup, native development-build verification, and Supabase project access are required before the remote Phase 03 deployment can be fully verified.

## Phase 01 scope

Implemented:

- Expo SDK 54 TypeScript project shell.
- Expo Router entrypoint with public and authenticated route groups.
- Authenticated tab shell with Home, Scan, My Plants, and Profile placeholders.
- Supabase client module using public Expo environment variables and SecureStore-backed auth persistence.
- Leaflet theme tokens in `constants/theme.ts`.
- Placeholder folders for shared components, hooks, app types, and assets.

Not implemented yet:

- Camera capture or plant scanning.
- Plant collection, care scheduling, diagnosis, notifications, onboarding, or monetization.

## Phase 02 scope

Implemented in app code:

- Central auth provider for Supabase session state.
- Session restore on launch.
- Auth route gating for public and authenticated route groups.
- Native Apple and Google ID-token sign-in flow wiring.
- Profile sign-out action.
- EAS development-build configuration for native provider testing.

Still required outside app code:

- Supabase Auth Apple provider configuration.
- Supabase Auth Google provider configuration.
- Apple Developer Sign in with Apple capability for `com.countrybean.leaflet`.
- Google Cloud OAuth clients and iOS URL scheme.
- Native development build verification that both providers create users in Supabase Auth.

## Phase 03 scope

Implemented in repo files:

- Versioned Supabase migration for `species`, `user_plants`, `care_tasks`, `care_logs`, `diagnoses`, and `scan_cache`.
- Constraints, foreign keys, timestamps, indexes, table grants, and RLS policies for Phase 03 data access.
- `plant-photos` and `scan-uploads` Storage bucket definitions plus user-folder policies.
- `identify-plant` Edge Function scaffold with CORS, JWT/user validation, request validation, and a placeholder response.
- App-side database types in `types/database.ts`.
- Thin future-facing function wrapper in `lib/api/identifyPlant.ts`.

Still required outside repo files:

- Supabase MCP or dashboard access to project `gnrjqqoidzuwzvhhfggh`.
- Applying `supabase/migrations/20260530163230_phase_03_database_backend.sql` to the target project.
- Deploying `supabase/functions/identify-plant/index.ts` with JWT verification enabled.
- Setting the `OPENAI_API_KEY` Edge Function secret in Supabase secret management.
- Creating real authenticated test users and verifying RLS/storage behavior with their sessions.

## Environment

Copy `.env.example` to `.env` and fill in the public Supabase values from your Supabase project:

```powershell
Copy-Item .env.example .env
```

Required variables:

```text
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=
```

Only use the public anon key in the Expo app. Do not put service-role keys, OpenAI keys, Apple secrets, or Google secrets in this repository.

## Run commands

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

Create a native development build for Phase 02 provider testing:

```powershell
npm run build:dev:ios
```

For Android Google sign-in testing:

```powershell
npm run build:dev:android
```

## Phase 01 verification checklist

- Expo starts without a blank screen.
- The app opens to the Phase 01 shell.
- The four tabs render: Home, Scan, My Plants, Profile.
- The Profile tab displays the Supabase configuration/session check message.
- Missing Supabase environment variables show a readable setup message.
- With valid Supabase values, `supabase.auth.getSession()` returns without throwing.

## Next phase

Finish the manual Phase 02/03 verification items: configure Apple/Google provider dashboards, create a development build, verify real sign-in creates Supabase Auth users, apply the Phase 03 migration to the target Supabase project, deploy the `identify-plant` Edge Function, and run the RLS/storage checks with real authenticated sessions. Phase 04 should reuse the existing `identify-plant` function instead of adding another scan endpoint.
