# Phase 10 Launch Readiness Notes

Phase 10 is release stabilization around the existing production care loop. No Supabase schema migration or Edge Function deployment is part of this checklist.

## App Store Listing Draft

**Name:** Leaflet - Plant Care Tracker

**Subtitle:** Scan, identify & keep plants alive.

**Promotional text:** Identify houseplants, save your collection, track care tasks, and get plant-health guidance from one lightweight app.

**Description:**
Leaflet helps houseplant owners move from "What plant is this?" to "What do I do next?" Scan a plant, review AI-assisted identification, save it to your collection, and keep care tasks visible on your dashboard. For sick plants, diagnosis mode can review a photo and provide practical care guidance with a clear advisory disclaimer.

Leaflet is built for public release. AI results can be imperfect, so always review recommendations before acting.

**Keywords:** plant care, houseplants, plant identification, watering reminder, plant health, plant diagnosis, garden, indoor plants

**Age rating target:** 4+

## Screenshot Plan

Capture 3-5 App Store screenshots after a physical-device build is stable:

1. Onboarding welcome or first scan prompt.
2. Scan camera or scan processing state with consent copy visible.
3. Identification result with alternates and Add to my plants.
4. Dashboard with health summary and due care tasks.
5. Plant detail with care schedule, care history, and diagnosis entry.

Minimum iOS screenshot sizes to prepare for App Store Connect: 6.7-inch and 6.1-inch iPhone.

## Privacy Labels Draft

Leaflet should disclose:

- **User content:** plant photos, saved plant details, care logs, diagnosis results.
- **Identifiers:** Supabase Auth user ID and provider account identifier/email where provided by Apple or Google.
- **Diagnostics:** app crash/build diagnostics only if Expo/EAS or App Store Connect collection is enabled.
- **Data linked to user:** account identifiers, plant collection data, uploaded photos, care and diagnosis records.
- **Tracking:** no cross-app tracking.
- **Data sale:** no user data sold to third parties.
- **Third-party processing:** scan and diagnosis photos are processed through Supabase and OpenAI.

## TestFlight And Release Validation Checklist

- Fresh install opens onboarding.
- Quick intent selection stores locally and advances to sign-in.
- Apple and Google sign-in both create or restore the expected Supabase Auth user.
- First scan requests camera permission in context.
- Scan result can be saved as the first plant.
- First save routes to activation and then dashboard.
- Returning signed-in launch goes directly to Home after onboarding completion.
- Signed-out returning launch goes directly to sign-in.
- Offline banner appears when the Supabase health check cannot be reached.
- Dashboard, collection, plant detail, species profile, scan, and diagnosis screens show friendly loading/error/empty states.
- Diagnosis result and saved diagnosis history both show the advisory disclaimer.
- Care reminders request appears after activation and schedules local notifications when permission is granted.
- Large text settings do not clip primary actions on onboarding, sign-in, scan, save, dashboard, and profile screens.
- Privacy Policy and Terms are reachable from sign-in and Profile.

## EAS Profiles

`eas.json` already contains:

- `development` with dev client and internal distribution.
- `preview` with internal distribution.
- `production` with auto-increment enabled.

Run the production iOS build only after the blockers in `docs/phase-10-launch-blockers.md` are resolved.
