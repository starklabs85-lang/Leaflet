# Leaflet - Product Roadmap / Implementation History

**Stack:** Expo SDK 54 / Supabase (Auth, Postgres, Storage, Edge Functions) / OpenAI Vision API / RevenueCat

**Target:** iOS-first App Store release, with Android support tracked as secondary.

---

## Core Product Phases (1-10)

These phase files are historical planning artifacts and implementation handoffs. They describe how the current production app surface was built.

| # | Phase | Goal | Key FRs |
|---|-------|------|---------|
| 01 | [Project Foundation](phase-01-project-foundation.md) | Expo project, navigation, Supabase client setup | - |
| 02 | [Authentication](phase-02-authentication.md) | Apple & Google sign-in with persistent sessions | FR-10, FR-11 |
| 03 | [Database & Backend](phase-03-database-backend.md) | Postgres schema, RLS, Storage, and Edge Functions | FR-5, FR-6, FR-7, FR-11 |
| 04 | [Scan & Identify](phase-04-scan-identify.md) | Camera capture to OpenAI-powered species identification | FR-1, FR-2 |
| 05 | [Plant Information](phase-05-plant-information.md) | Species profile with care instructions & toxicity | FR-3, FR-12 |
| 06 | [Plant Collection](phase-06-plant-collection.md) | Save, browse, edit, and delete tracked plants | FR-5 |
| 07 | [Care Scheduling](phase-07-care-scheduling.md) | Auto-generated schedules, quick-log, care history | FR-6, FR-7 |
| 08 | [Disease Diagnosis](phase-08-disease-diagnosis.md) | Diagnose sick plants with treatment plans | FR-4 |
| 09 | [Dashboard & Notifications](phase-09-dashboard-notifications.md) | Home screen + local push reminders | FR-8, FR-9 |
| 10 | [Onboarding & Launch](phase-10-onboarding-launch.md) | First-run flow, polish, App Store submission | All |

## Product Expansion Phases (11-12)

Post-launch additions that extend the core care loop.

| # | Phase | Goal |
|---|-------|------|
| 11 | [Growth Timeline & Streaks](phase-11-growth-streaks.md) | Photo timeline per plant + gamified care streaks |
| 12 | [Monetization](phase-12-monetization.md) | Generous free tier + non-intrusive premium subscription |

## Feature Phases (13-14)

New capabilities layered on the live app. Independent of each other.

| # | Phase | Goal |
|---|-------|------|
| 13 | [RevenueCat Payments](phase-13-revenuecat-payments.md) | Implement Phase 12's premium tier via RevenueCat (entitlements, restore, webhooks) |
| 14 | [Weather-Aware Care Tips](phase-14-weather-aware-care.md) | Location + weather-aware care tips replacing generic guidance (free for all users) |
| 15 | [Advanced Analytics](phase-15-advanced-analytics.md) | Premium-only deep care analytics (per-plant/per-type trends, ranges, health over time) as the first depth feature behind the paywall |

---

## How to use these docs

1. Use the phase files to understand original scope, acceptance criteria, and design decisions.
2. Treat the current app code and root `README.md` as the release handoff.
3. Each phase lists dependencies and verification notes that explain why later modules are structured the way they are.
4. Tech notes at the bottom of each phase give implementation guidance specific to Expo, Supabase, OpenAI, and RevenueCat.

## MCP tools available

- **Supabase MCP**: Create tables, set up auth, manage Edge Functions, configure Storage.
- **Expo skills**: Project setup, dev client builds, deployment.
- **Context7**: Fetch current docs for Expo, Supabase, React Native, and OpenAI SDKs.
- **Railway** (optional): If backend hosting is needed beyond Supabase.

---

## Implementation-plan convention

Each phase file contains the original product requirements plus a `Full implementation plan` section. Treat the original sections as the product contract and the implementation section as the engineering handoff: it expands the work into ordered tasks, expected modules, data flow, edge cases, verification checks, and release handoff notes.

When implementing new work, keep the change scoped to the named phase or feature area unless the current task explicitly calls for a cross-cutting release update.
