# Phase 10 — Onboarding & Launch Preparation

**Goal:** Build the first-run onboarding flow that gets users to their first scan as fast as possible, polish error states and loading experiences, and prepare the app for App Store submission.

**Requirements covered:** Completes the MVP (FR-1 through FR-11). Addresses non-functional requirements: privacy, accessibility, performance, reliability.

**Depends on:** All previous phases (01–09).

---

## What gets built

### 1. Onboarding flow (5 screens)

Matches the PRD's onboarding diagram. Shown only on first launch (track with `AsyncStorage` flag).

**Screen 1 — Welcome**
- App logo and name.
- Tagline: "Keep your plants alive."
- Brief value prop: "Scan a plant to identify it, learn how to care for it, and track its health."
- "Get started" button.

**Screen 2 — Quick intent**
- "What describes you best?"
- Two tappable cards:
  - "New plant parent" — "I have a few plants and want to keep them healthy."
  - "Growing collector" — "I have many plants and want to organize them."
- Single tap selects and auto-advances. Store the selection in the user's profile (or just in `AsyncStorage` for now — no profile table in the MVP schema).

**Screen 3 — Sign in**
- Same sign-in screen from Phase 02 (Apple & Google buttons).
- After successful sign-in, auto-advance to the next screen.

**Screen 4 — First scan prompt**
- "Let's scan your first plant!"
- Brief guidance: "Point your camera at a houseplant — we'll identify it instantly."
- "Open camera" button → navigates to the Scan tab with the camera active.
- Camera permission is requested here (in-context).

**Screen 5 — Activation**
- Reached after the first successful scan + save.
- "You're all set! [Plant name] is in your collection."
- Care schedule preview: "We'll remind you to water it in [X] days."
- "Go to dashboard" button → navigates to the Home tab.
- Notification permission is requested here (if not already granted).

**Skip option**: Users can skip to sign-in at any point. The onboarding completes once a plant is saved.

### 2. Error states & edge cases

Review and implement error handling across all screens:

#### Network errors
- Offline detection: show a banner "You're offline — some features need a connection."
- Failed API calls: show a retry button with the error context (not raw error messages).

#### Scan errors
- OpenAI timeout or failure: "We couldn't process your photo. Please try again."
- Low confidence result: clearly communicated, with alternates prominent and a "Try a different angle" suggestion.
- Image too dark/blurry: guide text encouraging a clearer photo.

#### Empty states
- Empty dashboard (no plants): points to the Scan tab.
- Empty care history: "Log your first care action!"
- Empty diagnosis history: "No diagnoses yet."

#### Loading states
- Consistent loading spinners/skeletons across the app.
- Scan processing: engaging leaf animation (not a generic spinner).

### 3. Accessibility pass

- All interactive elements have accessible labels (`accessibilityLabel`).
- Color contrast meets WCAG AA (the Leaflet palette should be fine — verify the green-on-paper combinations).
- Support Dynamic Type (system text scaling) — test at large and extra-large sizes.
- Ensure the camera guidance overlay is readable with VoiceOver.

### 4. Privacy & legal

- **Privacy policy**: Draft and host a privacy policy page (can be a simple web page or in-app WebView). Must cover:
  - Data collected (photos, account info, care data).
  - How photos are processed (sent to OpenAI via Supabase for analysis — disclose third-party AI usage).
  - Data storage (Supabase, cloud-hosted).
  - No data sold to third parties.
  - User data deletion process.
- **Terms of service**: Basic terms for the MVP.
- Link both from the Profile/Settings screen and the sign-in screen.
- **Photo consent**: The camera permission dialog and a brief in-app note explain that photos are sent to the cloud for analysis.
- **Diagnosis disclaimer**: Already implemented in Phase 08, verify it's visible.

### 5. App Store preparation

#### EAS Build setup
- Configure `eas.json` with build profiles: `development`, `preview`, `production`.
- Set up code signing (iOS provisioning profiles, certificates).
- Run a production build and test on a physical device.

#### App Store listing assets
- App name: "Leaflet — Plant Care Tracker" (or similar, check availability).
- Subtitle: "Scan, identify & keep plants alive."
- App icon: leaf icon from the PRD branding.
- Screenshots: 3-5 screenshots showing scan, plant info, dashboard, collection, diagnosis.
- Description: concise, keyword-rich.
- Privacy nutrition labels: fill out based on the privacy policy.
- Age rating: 4+ (no objectionable content).

#### TestFlight
- Upload a build to TestFlight for beta testing before public submission.
- Test the complete flow: sign-in → scan → save → care tasks → notifications → diagnosis.

---

## Acceptance criteria

- [ ] First-time users see the 5-screen onboarding flow.
- [ ] Returning users skip onboarding and go straight to the app (or sign-in if session expired).
- [ ] Quick intent selection is captured (even if not used functionally in the MVP).
- [ ] After first scan + save, the user lands on the dashboard with their plant visible.
- [ ] All error states show user-friendly messages with retry options (no raw errors).
- [ ] Offline state is detected and communicated.
- [ ] All empty states have helpful illustrations and CTAs.
- [ ] Privacy policy and terms are accessible from the app.
- [ ] The diagnosis disclaimer is visible on every diagnosis result.
- [ ] A production EAS build runs without crashes on a physical iOS device.
- [ ] The app is uploaded to TestFlight and the complete flow works end-to-end.

---

## Tech notes

- **Onboarding persistence**: Use `AsyncStorage.setItem('onboarding_complete', 'true')` after the first plant is saved. Check this on app launch to skip onboarding for returning users.
- **EAS Build**: Requires an Expo account and `eas-cli`. The `eas build --platform ios --profile production` command creates a production binary. Follow Expo's submission guide for the App Store.
- **Privacy policy hosting**: For the MVP, a static HTML page hosted on GitHub Pages, Vercel, or even a Supabase Storage public file is sufficient. Link to it via a URL in the app.
- **Screenshots**: Use the iOS simulator at required resolutions (6.7" and 6.1" at minimum). Consider using Fastlane's `snapshot` tool if you want automated screenshots, but manual is fine for the MVP.
- **Testing checklist before submission**:
  - Fresh install flow (onboarding → sign-in → first scan).
  - Returning user flow (app restore → dashboard → care tasks).
  - Sign-in with Apple and Google both work.
  - Scan identifies a common plant correctly.
  - Diagnosis returns a condition for a visibly sick plant.
  - Notifications fire at the scheduled time.
  - Sign-out and re-sign-in preserves data.
  - App handles network loss gracefully.

---

## Full implementation plan

### Implementation objective
Prepare the MVP for real beta users by adding a fast onboarding path, completing app-wide error and empty states, meeting privacy/accessibility expectations, and producing a TestFlight-ready build.

### Ordered build tasks
1. Build the 5-screen onboarding flow described in this phase using the public route group.
2. Persist onboarding completion locally after the user saves the first plant, while still respecting auth session state.
3. Route first-time users through onboarding and returning users directly to the app or sign-in depending on session validity.
4. Add quick intent selection and store it locally or in a lightweight user preference if available.
5. Review every major feature surface for loading, empty, error, offline, and retry states.
6. Add global offline detection and a non-blocking offline banner.
7. Add accessibility labels, Dynamic Type support, touch target checks, and contrast review for key screens.
8. Add privacy policy and terms links to sign-in and Profile/Settings.
9. Add photo-processing consent copy near camera usage and cloud AI analysis flows.
10. Verify diagnosis disclaimers are visible wherever diagnosis results appear.
11. Configure EAS build profiles for development, preview, and production.
12. Prepare App Store listing copy, screenshots, privacy labels, and TestFlight submission assets.
13. Run an end-to-end beta checklist on a physical iOS device.

### Expected files and modules
- Onboarding routes/screens live in the public flow and lead toward sign-in and first scan.
- App launch logic considers both auth session and onboarding completion.
- Shared error, empty, loading, and offline UI components reduce inconsistent handling.
- Legal links are centralized in settings/constants.
- EAS configuration lives in `eas.json` and app metadata remains in Expo config.

### Data and state flow
- Fresh install starts with onboarding unless the user intentionally skips.
- Sign-in remains required before cloud-backed scan/save flows.
- First successful scan plus save marks onboarding complete.
- Returning users with valid sessions skip onboarding and land on Home.
- Returning users without sessions go to sign-in and then Home after auth.

### Launch-readiness requirements
- No raw backend or provider errors should reach user-facing screens.
- Photo consent must disclose cloud processing and third-party AI analysis.
- Privacy policy must mention account data, photos, care data, Supabase storage, and OpenAI processing.
- TestFlight build should use production-like environment variables and provider configuration.
- Screenshots should show scan, identification result, plant detail/care, dashboard, and collection.

### Edge cases and failure handling
- If onboarding persistence fails, default to a safe repeatable onboarding state rather than blocking app access.
- If legal URLs fail to open, show a fallback message and retry option.
- Offline mode should explain which features require connection without hiding existing local UI.
- Large text settings should not clip critical action buttons.
- App Store/TestFlight setup blockers should be documented separately from app code tasks.

### Verification checklist
- Fresh install shows onboarding.
- Existing signed-in user skips onboarding after completion.
- Skip path still leads to sign-in and allows first scan later.
- Offline banner appears when network is unavailable.
- Empty and error states are friendly and retryable.
- Accessibility labels exist on major interactive controls.
- Privacy and terms links are reachable from sign-in and settings.
- Production EAS build installs and launches on a physical iOS device.
- TestFlight upload completes and the core flow works end to end.

### Handoff to Phase 11
Phase 11 should begin only after the MVP loop is stable for beta users. It should add retention features without destabilizing launch-critical flows.
