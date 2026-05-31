# Phase 02 — Authentication

**Goal:** Users can sign in with Apple or Google, maintain a persistent session, and be routed to the main app — cloud identity is established from day one.

**Requirements covered:** FR-10 (Sign in with Apple & Google via Supabase Auth), FR-11 (Account & cloud sync foundation).

**Depends on:** Phase 01 (project foundation, Supabase client).

---

## What gets built

### 1. Supabase Auth configuration
- Enable **Apple** and **Google** as OAuth providers in the Supabase dashboard (or via MCP).
- Configure redirect URLs for the Expo deep link scheme (`your-app-scheme://`).
- Apple:
  - Requires Apple Developer account, Services ID, and Sign in with Apple capability.
  - App Store policy: if you offer Google sign-in, Apple sign-in is **mandatory**.
- Google:
  - Requires Google Cloud OAuth 2.0 credentials (iOS client ID).
  - Configure `@react-native-google-signin/google-signin` with the web client ID from Google Cloud.

### 2. Sign-in screen
- Clean, minimal screen inside the `(public)` route group.
- App logo + tagline ("Keep your plants alive.").
- Two buttons:
  - **Sign in with Apple** — uses `expo-apple-authentication` for the native flow, then passes the identity token to `supabase.auth.signInWithIdToken()`.
  - **Sign in with Google** — uses `@react-native-google-signin/google-signin` for the native flow, then passes the ID token to `supabase.auth.signInWithIdToken()`.
- Error handling: show a toast/alert if sign-in fails with a retry option.
- No email/password sign-in in the MVP — keep it simple.

### 3. Session persistence & auth state
- On app launch, check `supabase.auth.getSession()`:
  - If a valid session exists → route to `(auth)` group (main app tabs).
  - If no session → route to `(public)` group (sign-in screen).
- Listen to `supabase.auth.onAuthStateChange()` to handle token refresh and sign-out events.
- Store tokens via `expo-secure-store` (configured in Phase 01's Supabase client).

### 4. Auth-gated routing
- The root `_layout.tsx` checks auth state and renders either the `(public)` or `(auth)` layout.
- Use a loading/splash state while checking the session to avoid flash of wrong screen.

### 5. Sign-out
- Add a sign-out button in the Profile/Settings tab.
- Calls `supabase.auth.signOut()`, which triggers `onAuthStateChange` and redirects to sign-in.

---

## Acceptance criteria

- [ ] Tapping "Sign in with Apple" completes the native Apple sign-in flow and creates a user in Supabase Auth.
- [ ] Tapping "Sign in with Google" completes the native Google sign-in flow and creates a user in Supabase Auth.
- [ ] After sign-in, the user lands on the main app (tab navigator).
- [ ] Closing and reopening the app restores the session — no re-sign-in required.
- [ ] Tapping "Sign out" returns to the sign-in screen and clears the session.
- [ ] Auth state is visible in the Supabase dashboard (user appears in the Users table).

---

## Tech notes

- **Apple sign-in on iOS** uses the native `expo-apple-authentication` module. The identity token returned is passed to Supabase's `signInWithIdToken({ provider: 'apple', token })`.
- **Google sign-in** uses `@react-native-google-signin/google-signin`. After the native flow, pass the `idToken` to Supabase's `signInWithIdToken({ provider: 'google', token })`.
- Both flows use Supabase's **ID token** method (not OAuth redirect), which is the recommended pattern for native mobile apps — no browser popup.
- **Important:** This phase requires a **dev client build** (not Expo Go) because native sign-in modules need custom native code. Set up `eas build --profile development` for this phase.
- The Supabase `auth.users` table auto-populates with provider info — no custom user table needed yet.

---

## Full implementation plan

### Implementation objective
Implement cloud identity from the beginning using Supabase Auth with Apple and Google native sign-in. After this phase, the app should reliably restore sessions, gate routes, and support sign-out from the Profile tab.

### Ordered build tasks
1. Configure a development build workflow because Apple and Google native sign-in require native modules and will not work in plain Expo Go.
2. Register the app scheme, bundle identifiers, and redirect URLs consistently across Expo config, Supabase Auth, Apple Developer, and Google Cloud.
3. Enable Apple and Google providers in Supabase Auth.
4. Build the public sign-in screen with app identity, short tagline, Apple button, Google button, loading state, and friendly error state.
5. Implement Apple sign-in with `expo-apple-authentication`, then pass the identity token to `supabase.auth.signInWithIdToken()`.
6. Implement Google sign-in with `@react-native-google-signin/google-signin`, then pass the ID token to `supabase.auth.signInWithIdToken()`.
7. Add an auth provider/hook that owns session loading, `onAuthStateChange`, sign-in status, and sign-out.
8. Replace Phase 01 placeholder route gating with real public/authenticated routing.
9. Add sign-out to the Profile/Settings tab and verify that it clears the session.
10. Document required dashboard-only provider secrets outside the app code.

### Expected files and modules
- `providers/AuthProvider.tsx` or `contexts/AuthContext.tsx` owns session state and auth actions.
- `app/_layout.tsx` consumes auth state and prevents flashing the wrong route while loading.
- `app/(public)/sign-in.tsx` contains the sign-in UI and provider buttons.
- `app/(auth)/(tabs)/profile.tsx` exposes sign-out.
- `lib/auth.ts` may hold provider-specific sign-in helpers if the screen gets too large.

### Data and state flow
- App launch calls `supabase.auth.getSession()` once.
- The auth provider stores `session`, `user`, `isLoading`, and `authError` state.
- Apple/Google native SDKs return identity tokens to the client.
- The client exchanges identity tokens with Supabase Auth through `signInWithIdToken`.
- Supabase emits auth state changes; the root layout reacts by routing to public or authenticated groups.
- Sign-out calls Supabase, clears local secure session storage, and returns the user to sign-in.

### External setup
- Apple requires an Apple Developer account, app identifier, Sign in with Apple capability, and valid bundle ID.
- Google requires OAuth client IDs and the web client ID used by the native sign-in package.
- Supabase must list all development and production redirect URLs.
- EAS development builds should be introduced here if they were intentionally deferred in Phase 01.

### Edge cases and failure handling
- User-cancelled provider flows should not show scary errors.
- Missing provider tokens should show a retryable message.
- Network failures should preserve the current screen and allow retry.
- Route gating should show a loading/splash state while the session is being restored.
- If a provider is unavailable on a platform, hide or disable only that provider button.

### Verification checklist
- A development build installs successfully on a real device or simulator.
- Apple sign-in creates a Supabase Auth user.
- Google sign-in creates a Supabase Auth user.
- App restart restores the session without another sign-in.
- Sign-out returns to the public sign-in screen.
- Supabase dashboard shows provider metadata for the signed-in user.

### Handoff to Phase 03
Phase 03 can assume `auth.uid()` is available in Supabase policies and that app requests are associated with authenticated users.
