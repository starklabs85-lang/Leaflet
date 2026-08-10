# Fernly onboarding, analytics, and design QA

## Current onboarding contract

This artifact reflects the production Expo app in this repository, not a
prototype. The current journey is:

1. `welcome`: branded plant hero, “Happy plants, happy you,” and one Get started
   CTA.
2. `account-choice`: new users receive a private anonymous session; returning
   users go to Apple/Google sign-in.
3. `sign-in`: explains that a permanent identity is required to save scans,
   photos, care tasks, and diagnosis history; onboarding can be skipped to the
   normal sign-in surface.
4. `first-scan`: asks for camera permission only when Open camera is chosen and
   offers Scan later.
5. `activation`: confirms the saved plant when present, requests local care
   reminders, and routes to the dashboard.

Authenticated permanent users route directly home. Only temporary anonymous
users with `needs_onboarding` remain under the onboarding guard. Onboarding
state and auth restoration render a fixed loading screen rather than a partially
initialized product surface.

## Analytics contract

- Firebase automatic collection and automatic screen reporting are disabled in
  `app.config.ts`.
- A first-party full-screen choice runs before optional measurement. Declining
  leaves essential account, plant, AI, subscription, security, and deletion
  services available.
- Pre-consent events are discarded and never replayed.
- After consent, sanitized allowlisted events route through the centralized
  Firebase and AppsFlyer adapters.
- Current generated contract: 54 event definitions, 7 tap identifiers, and 7
  allowlisted user-property keys.
- AppsFlyer receives no client-side revenue fields. Analytics excludes photos,
  plant names, email addresses, exact location, prompts, URLs, and raw errors.
- Users can change the saved measurement choice in Profile → Privacy choices.
- `npm run analytics:check` is a release gate; generated files are not edited by
  hand.

Production paging is separate from analytics. No pager field may be sourced
from analytics parameters, profile identifiers, or model content.

## Source-level design QA

- [x] Welcome and account-choice CTAs have explicit accessibility labels/hints.
- [x] First-scan permission is contextual and has a non-blocking Scan later path.
- [x] Loading, error, and reminder states use fixed user-facing copy.
- [x] The privacy choice is modal, names both optional providers, and gives
  equally available allow/decline actions.
- [x] Shared theme tokens drive typography, spacing, colors, cards, gradients,
  and button variants across the reviewed onboarding screens.
- [x] Scroll/safe-area containers are present on the welcome and privacy choice
  screens.
- [ ] Physical-device QA is still required for small-screen text scaling,
  VoiceOver order, camera denial/settings recovery, notification denial, reduced
  motion, offline startup, and a saved-plant activation state.
- [ ] Current App Store candidate screenshots were not available in this task
  for pixel-level comparison.

No design change is part of the production-ops backend rollout. Any visual fix
requires its own reviewed mobile release candidate and explicit build approval.
