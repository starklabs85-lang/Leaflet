# Leaflet — Phased MVP Roadmap

**Stack:** Expo (SDK 52+) / Supabase (Auth, Postgres, Storage, Edge Functions) / OpenAI Vision API

**Target:** Solo developer building toward App Store launch.

---

## MVP Phases (1–10)

Each phase implements one goal. Complete them in order — each builds on the previous.

| # | Phase | Goal | Key FRs |
|---|-------|------|---------|
| 01 | [Project Foundation](phase-01-project-foundation.md) | Expo project, navigation, Supabase client setup | — |
| 02 | [Authentication](phase-02-authentication.md) | Apple & Google sign-in with persistent sessions | FR-10, FR-11 |
| 03 | [Database & Backend](phase-03-database-backend.md) | Postgres schema, RLS, Storage, Edge Function scaffold | FR-5, FR-6, FR-7, FR-11 |
| 04 | [Scan & Identify](phase-04-scan-identify.md) | Camera capture → OpenAI → species identification | FR-1, FR-2 |
| 05 | [Plant Information](phase-05-plant-information.md) | Species profile with care instructions & toxicity | FR-3, FR-12 |
| 06 | [Plant Collection](phase-06-plant-collection.md) | Save, browse, edit, and delete tracked plants | FR-5 |
| 07 | [Care Scheduling](phase-07-care-scheduling.md) | Auto-generated schedules, quick-log, care history | FR-6, FR-7 |
| 08 | [Disease Diagnosis](phase-08-disease-diagnosis.md) | Diagnose sick plants with treatment plans | FR-4 |
| 09 | [Dashboard & Notifications](phase-09-dashboard-notifications.md) | Home screen + local push reminders | FR-8, FR-9 |
| 10 | [Onboarding & Launch](phase-10-onboarding-launch.md) | First-run flow, polish, App Store submission | All |

## Fast Follow Phases (11–12)

Ship after MVP is live and the core loop is validated.

| # | Phase | Goal |
|---|-------|------|
| 11 | [Growth Timeline & Streaks](phase-11-growth-streaks.md) | Photo timeline per plant + gamified care streaks |
| 12 | [Monetization](phase-12-monetization.md) | Generous free tier + non-intrusive premium subscription |

## Feature Phases (13–14)

New capabilities layered on the live app. Independent of each other.

| # | Phase | Goal |
|---|-------|------|
| 13 | [RevenueCat Payments](phase-13-revenuecat-payments.md) | Implement Phase 12's premium tier via RevenueCat (entitlements, restore, webhooks) |
| 14 | [Weather-Aware Care Tips](phase-14-weather-aware-care.md) | Location + weather-aware care tips replacing generic guidance (free for all users) |
| 15 | [Advanced Analytics](phase-15-advanced-analytics.md) | Premium-only deep care analytics (per-plant/per-type trends, ranges, health over time) — first depth feature behind the paywall |

---

## How to use these docs

1. Start with Phase 01. Read the acceptance criteria — they define "done" for each phase.
2. Build and verify each phase before moving to the next.
3. Each phase lists its dependencies so you know what must exist first.
4. Tech notes at the bottom of each phase give implementation guidance specific to Expo, Supabase, and OpenAI.

## MCP tools available

- **Supabase MCP**: Create tables, set up auth, manage Edge Functions, configure Storage.
- **Expo skills**: Project scaffolding, dev client builds, deployment.
- **Context7**: Fetch current docs for Expo, Supabase, React Native, and OpenAI SDKs.
- **Railway** (optional): If backend hosting is needed beyond Supabase.

---

## Implementation-plan convention

Each phase file now contains the original product requirements plus a `Full implementation plan` section. Treat the original sections as the product contract and the implementation section as the engineering handoff: it expands the work into ordered tasks, expected modules, data flow, edge cases, verification checks, and the handoff to the next phase.

When implementing, work phase by phase in order. Do not pull future-phase behavior into an earlier phase unless the current phase explicitly names it as scaffolding or a placeholder.
