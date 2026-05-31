# Phase 01 — Project Foundation

**Goal:** Stand up the Expo project, navigation skeleton, and Supabase project so every future phase has infrastructure to build on.

**Requirements covered:** None directly — this is scaffolding that enables FR-1 through FR-11.

---

## What gets built

### 1. Expo project initialization
- Initialize with `npx create-expo-app@latest leaflet` using Expo SDK 52+ (confirm latest stable at build time).
- TypeScript template.
- Folder structure:
  ```
  app/              # Expo Router file-based routing
    (auth)/         # Auth-gated screens (tabs, etc.)
    (public)/       # Unauthenticated screens (onboarding, sign-in)
    _layout.tsx     # Root layout
  components/       # Shared UI components
  lib/              # Supabase client, API helpers, constants
  hooks/            # Custom React hooks
  types/            # TypeScript type definitions
  assets/           # Images, fonts
  ```
- Install core dependencies:
  - `expo-router` (file-based routing)
  - `expo-camera` / `expo-image-picker`
  - `expo-notifications`
  - `@supabase/supabase-js`
  - `expo-secure-store` (for session persistence)
  - `expo-apple-authentication`
  - `@react-native-google-signin/google-signin`

### 2. Navigation skeleton
- **Root layout** with auth state check — redirects to sign-in or main app.
- **Tab navigator** (inside auth gate) with placeholder screens:
  - Home (Dashboard)
  - Scan
  - My Plants (Collection)
  - Profile / Settings
- Each tab screen renders a placeholder `<Text>` — just enough to verify navigation works.

### 3. Supabase project creation
- Create a new Supabase project via the MCP or dashboard.
- Note the project URL and anon key.
- Create `lib/supabase.ts` — initializes the Supabase client with `expo-secure-store` for auth token persistence.
- Add `.env` / `app.config.ts` for environment variables:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### 4. Design tokens & base styling
- Set up a `constants/theme.ts` with the Leaflet color palette from the PRD:
  - Paper, Forest, Leaf, Terra, Ochre, etc.
  - Typography scales (use system fonts for MVP; Fraunces/Hanken Grotesk can come later).
- No component library — keep it lean with StyleSheet or a minimal approach.

---

## Acceptance criteria

- [ ] `npx expo start` launches without errors.
- [ ] Tab navigation works on iOS simulator — all 4 tabs render placeholder screens.
- [ ] Supabase client initializes and can reach the project (e.g., a simple health check or `supabase.auth.getSession()` returns without error).
- [ ] Environment variables load correctly.
- [ ] Project runs on a physical device via Expo Go or dev client.

---

## Tech notes

- **Expo Router** uses file-based routing under `app/`. The `(auth)` and `(public)` route groups handle gating.
- **Supabase client** should use `expo-secure-store` as the storage adapter so auth tokens survive app restarts. See Supabase docs for the Expo integration pattern.
- Don't install EAS Build yet — that's a Phase 10 concern. Expo Go is fine for development.
- Keep the dependency list minimal. Only install what this phase explicitly needs.

---

## Full implementation plan

### Implementation objective
Create the minimum viable Expo/Supabase foundation that every later phase can build on without reworking navigation, configuration, or shared styling. This phase should leave the app runnable on a simulator and physical device with authenticated and public route groups stubbed, even though real sign-in is implemented in Phase 02.

### Ordered build tasks
1. Initialize the Expo app with TypeScript and Expo Router enabled.
2. Install only dependencies required by this phase and near-term phases: routing, camera/image picker, notifications, Supabase, secure storage, and native auth packages.
3. Create the route-group skeleton under `app/` with root layout, public layout, authenticated tab layout, and placeholder tab screens.
4. Add a Supabase client module that reads public environment variables and uses SecureStore-compatible auth persistence.
5. Add `app.config.ts` so Expo receives the Supabase URL/key and a stable app scheme for future auth redirects.
6. Add shared constants for palette, spacing, radius, typography scale, and screen padding.
7. Add lightweight reusable primitives only where they reduce duplication: screen container, text styles, and placeholder tab content.
8. Add a simple auth/session loading placeholder in the root layout. For Phase 01, it can route to placeholders without real provider login.

### Expected files and modules
- `app/_layout.tsx` owns global providers, route gating placeholder, and splash/loading behavior.
- `app/(public)/sign-in.tsx` is a placeholder public entry point for Phase 02.
- `app/(auth)/(tabs)/_layout.tsx` defines the four main tabs: Home, Scan, My Plants, Profile.
- `lib/supabase.ts` exports the configured Supabase client.
- `constants/theme.ts` exports palette, typography, spacing, and radius tokens.
- `.env.example` documents required public Supabase variables without committing secrets.

### Data and state flow
- Expo loads public variables through `app.config.ts` and `EXPO_PUBLIC_*` values.
- `lib/supabase.ts` creates a single client instance used throughout the app.
- Root layout checks session state with `supabase.auth.getSession()` and exposes a temporary loading state.
- Until Phase 02 is complete, route gating may be permissive or mocked, but the file structure must match the final auth/public split.

### External setup
- Create or identify the Supabase project before wiring the client.
- Record the project URL and anon key in local `.env` only.
- Do not add service-role keys, OpenAI keys, Apple secrets, or Google secrets to the app repo.

### Edge cases and failure handling
- Missing Supabase env vars should fail loudly in development with a readable message.
- Supabase connectivity checks should surface a friendly placeholder state instead of crashing the app tree.
- The app should avoid requesting camera, notification, or auth permissions during this foundation phase.

### Verification checklist
- `npx expo start` launches the project.
- The root layout renders without a blank screen.
- Each of the four tabs is reachable and displays placeholder content.
- `supabase.auth.getSession()` can be called without throwing.
- Environment variables resolve in the Expo runtime.
- The app opens on a physical device through Expo Go or a development build.

### Handoff to Phase 02
Phase 02 should replace the placeholder auth behavior with real Apple/Google sign-in while keeping the route-group structure, Supabase client, app scheme, and theme tokens created here.
