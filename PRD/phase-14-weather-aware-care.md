# Phase 14 — Location & Weather-Aware Care Tips

**Goal:** Replace generic, species-only care guidance with **contextual tips that account for the user's local weather and each plant's placement** — e.g. "Frost tonight (low -2°C): bring your basil in" or "Rain expected today — skip watering the patio fern." This turns Leaflet from a static reference into an assistant that reacts to the real conditions a plant is living in, deepening the daily-return habit.

**Requirements covered:** Extends FR-3 (plant information) and FR-6/FR-7 (care scheduling & logging) with environmental context. New capability — not in the original FR set.

**Depends on:** Phase 05 (species `care_profile` available), Phase 06 (plants in collection), Phase 07 (care tasks/logs), Phase 09 (dashboard + local notifications to surface tips and alerts).

**Phase type:** Feature enhancement (post-MVP). Independent of Phase 13 — **weather tips are fully free** and must not be entitlement-gated.

---

## 1. Problem & why now

Leaflet's care guidance today is derived only from the species `care_profile` (e.g. "water every 7 days"). That's a fixed average that ignores reality: the same monstera needs water sooner during a heat wave and later during a damp, dark week; an outdoor plant can be killed by a single frost the app never warned about. Generic advice is exactly what every plant app gives — it's neither memorable nor differentiating, and it produces care reminders that are sometimes wrong (telling someone to water on a rainy day, or staying silent the night a freeze rolls in).

Weather context is the highest-leverage way to make the core loop feel *smart* and *local*, and it pairs naturally with the existing care schedule and reminder engine. It's also a strong free-tier differentiator (see decision below).

## 2. Target users

- **Primary — the anxious-but-engaged keeper:** checks the app often, wants reassurance they're doing the right thing *today*, given the weather outside their window.
- **Secondary — the outdoor/balcony gardener:** has frost-, heat-, and rain-sensitive plants where weather is the difference between alive and dead. Highest stakes, highest value from alerts.
- **Tertiary — the indoor-only keeper:** weather still matters indirectly (winter heating dries the air; short daylight slows growth; heat waves bake plants by sunny windows).

## 3. Success metrics

- **Primary:** Tip engagement — % of daily-active users who view/expand a weather tip, and tap-through to a plant or a one-tap care adjustment.
- **Secondary:** Care-log completion lift on days a contextual tip is shown vs. not; frost-alert open rate; "snooze/advance watering" adoption.
- **Guardrail:** Notification opt-out rate must not spike (don't become noisy); location-permission grant rate (if it's very low, the manual-city fallback is carrying the feature).
- **North-star tie-in:** Day-7 / Day-30 retention — contextual relevance should raise return frequency.

## 4. Monetization decision

**Weather-aware tips are fully free for all users** (decided). This is a deliberate differentiation play against paywall-heavy competitors and reinforces Phase 12's "generous free tier" wedge. Do **not** add `isPremium` checks to any weather surface. Phase 13 monetization stands on its own (scan/collection/photo volume).

---

## What gets built

### 1. Location capture (with a graceful fallback)

- Add `expo-location`. Request **foreground, when-in-use** location only (no background tracking).
- Flow:
  - A clear, benefit-framed prompt: "Allow location so Leaflet can tailor care to your weather." Triggered contextually (e.g. first dashboard visit), not at launch.
  - On grant: get coarse coordinates, **round to ~2 decimal places (~1 km)** for privacy, optionally reverse-geocode to a city label for display.
  - On deny / unavailable: offer **manual city entry** (geocode once to coords). The feature must work without GPS.
- Persist the chosen location (coords + label + source) locally in SecureStore and as a lightweight preference; re-confirm if it goes stale.
- Privacy: location is used **only** to fetch weather. Surface this in-app and in the store privacy labels. Add the iOS `NSLocationWhenInUseUsageDescription` and Android location permissions via the `expo-location` config plugin.

### 2. Plant placement model

Weather affects an outdoor plant directly and an indoor plant indirectly, so each plant needs a placement signal.
- Add `placement` to `user_plants`: `'indoor' | 'outdoor' | 'balcony' | 'unknown'` (default `'unknown'`, treated as indoor for safety).
- Optionally add `light_exposure` (`'low' | 'medium' | 'bright' | 'unknown'`) to refine indoor effects (a plant by a south window is hit harder by a heat wave).
- Capture placement at plant-save (Phase 06) and editable on the plant detail screen. The existing free-text `user_plants.location` stays as a human label ("kitchen sill"); `placement` is the new structured field the engine reads.

### 3. Weather fetch (server-side, cached) — Open-Meteo

- Provider: **Open-Meteo** (free, no API key, current + hourly + daily forecast). Wrap it behind a small provider interface so it can be swapped later.
- Fetch through a **Supabase Edge Function** (`weather-tips`), not directly from the client, so we can:
  - Cache responses in a `weather_cache` table keyed by **rounded coords + date** (and forecast horizon), so users in the same area share a cache entry and we stay polite to the API.
  - Centralize the provider and any future keyed-provider swap.
- Pull the signals the engine needs: current temp, daily min/max, precipitation probability/amount, wind, humidity, UV, and short-term frost/heat outlook.

### 4. Tip engine — rule-based signals + LLM phrasing

Deterministic rules derive **signals** by combining weather + species `care_profile` + plant `placement`/`light_exposure`; the existing OpenAI Edge Function then phrases the top signals into short, friendly, on-brand tips. Rules decide *what* to say (testable, predictable, no hallucinated care advice); the LLM decides *how* to say it.

Core signals (starter set — extend over time):

| Signal | Condition (weather × plant) | Example tip |
|--------|-----------------------------|-------------|
| Frost / freeze risk | Daily min ≤ ~2–4°C AND (outdoor/balcony OR cold-sensitive species) | "Frost tonight (low -2°C). Bring {plant} indoors or cover it." |
| Heat wave | High max temp / high UV AND (outdoor OR bright indoor) | "Hot & bright today — check {plant}'s soil a day early; it'll dry faster." |
| Rain incoming | High precip probability AND outdoor/balcony AND water due soon | "Rain expected — skip watering {plant} today." |
| Dry indoor air | Low outdoor temp (heating season) AND humidity-loving species (reuses `hasHighHumidityNeed`) | "Heating dries indoor air. Mist {plant} or group your tropicals." |
| Low light / short days | Low daylight / overcast stretch | "Light's low this week — growth slows, so ease off watering." |
| High humidity | High humidity AND misting active | "Air's humid today — hold the misting to avoid fungal issues." |

- **Severity & ranking:** each signal carries a severity; the engine surfaces the top 1–3 per day and routes high-severity ones (frost) to notifications.
- **Care adjustment, suggested not silent:** when a signal implies a schedule change (rain → delay watering; heat → advance it), offer a **one-tap action** ("Snooze watering 2 days" / "Mark to water early") that updates the relevant `care_task.next_due_date`. Never silently rewrite the schedule.
- **LLM phrasing is optional/degradable:** if the LLM call fails or is slow, fall back to clear rule templates so tips always render.

### 5. Surfacing the tips

- **Dashboard (Phase 09):** a "Today near you" strip (location label + condition + temp) and a prioritized tips card (top 1–3), each linking to the relevant plant or care action.
- **Plant detail (Phase 06/07):** a per-plant weather-aware note alongside the care schedule.
- **Notifications (extends Phase 09 / `careReminders`):** opt-in **severe-weather alerts** (primarily frost) reusing the existing notification + Android channel + SecureStore scheduling infrastructure. Keep these rare and high-value to protect the opt-out guardrail.

---

## Acceptance criteria

- [ ] The app requests when-in-use location with a clear benefit rationale; denying it still allows manual city entry, and the feature works either way.
- [ ] Stored coordinates are coarse (~1 km) and used only for weather.
- [ ] Each plant has a `placement` (and optional `light_exposure`) set at save and editable later.
- [ ] Weather is fetched via the `weather-tips` Edge Function and cached by rounded coords + date in `weather_cache`.
- [ ] The rule engine produces correct signals for frost, heat, rain, dry-air, low-light, and high-humidity cases given weather + species + placement.
- [ ] Tips are phrased by the LLM but **always render** via rule templates if the LLM is unavailable.
- [ ] The dashboard shows local conditions and the top 1–3 prioritized tips, linking to the relevant plant/action.
- [ ] The plant detail screen shows a per-plant weather-aware tip.
- [ ] Weather-implied schedule changes are offered as one-tap actions that update `care_task.next_due_date` — never applied silently.
- [ ] Opt-in frost alerts fire through the existing notification system and are rare/high-value.
- [ ] The entire feature is available to free users (no premium gating).

### Non-goals / quality bars
- [ ] No background location tracking.
- [ ] No care advice invented by the LLM beyond what the rules supply (LLM only rephrases provided signals).

---

## Tech notes

- **Open-Meteo:** keyless and generous; still cache server-side to dedupe across nearby users and survive provider hiccups. Keep the provider behind an interface for a future swap.
- **Reuse existing care logic:** `hasHighHumidityNeed`, `parseIntervalDays`, and the local-date helpers in `lib/api/careSchedule.ts` already encode the species-side reasoning the engine needs — extend, don't duplicate.
- **Reuse the notification stack:** `lib/notifications/careReminders.ts` already manages permissions, the Android channel, 9 AM scheduling, and SecureStore-backed schedule storage. Frost alerts should plug into this, not a parallel system. Remember the project rule: **no colons in SecureStore keys** — use the `leaflet.*` dot convention already in place.
- **LLM phrasing should be cheap and bounded:** batch the day's top signals into one short prompt; cache the phrased output with the weather cache entry so repeated dashboard loads don't re-call the model.
- **Don't over-trust thresholds:** frost/heat thresholds are starting points; make them adjustable (ideally remote-config later) and conservative — a false "bring it in" is far cheaper than a missed freeze.
- **Use Context7** for current `expo-location` permission/config-plugin APIs and Open-Meteo's current endpoint/params at implementation time.

---

## Full implementation plan

### Implementation objective
Make care guidance react to local weather and per-plant placement, surfaced calmly on the dashboard, plant detail, and (for severe weather) notifications — fully free, with deterministic rules and degradable LLM phrasing.

### Ordered build tasks
1. Add `expo-location`; build the permission flow with a benefit-framed prompt and a manual-city fallback; persist coarse coords + label.
2. Add `placement` (and optional `light_exposure`) to `user_plants`; capture at save and on plant detail edit.
3. Build the Open-Meteo provider behind an interface; create the `weather-tips` Edge Function and `weather_cache` table keyed by rounded coords + date.
4. Build the rule engine: map weather signals × species `care_profile` × placement → ranked, severity-tagged signals (reuse existing care helpers).
5. Add LLM phrasing of the top signals via the existing OpenAI Edge Function, with rule-template fallback and cached output.
6. Surface tips: dashboard "Today near you" strip + prioritized card; per-plant tip on plant detail.
7. Add one-tap care adjustments that update `care_task.next_due_date` (suggested, never silent).
8. Add opt-in frost/severe-weather notifications through the existing `careReminders` infrastructure.
9. Add privacy copy + store permission strings; verify no premium gating anywhere.

### Expected files and modules
- `lib/location/userLocation.ts` — permission, coords (rounded), manual city, persistence.
- `lib/weather/provider.ts` (Open-Meteo behind an interface) + `lib/weather/tips.ts` (rule engine + ranking).
- `supabase/functions/weather-tips` Edge Function; `weather_cache` table migration; `user_plants.placement` migration.
- Dashboard tip components (reuse Phase 09 card patterns); plant-detail tip section.
- Notification additions in/alongside `lib/notifications/careReminders.ts` for severe-weather alerts.
- Types for weather snapshot, care signal, and tip.

### Data and state flow
- User grants location (or enters a city) → coarse coords stored locally.
- Dashboard load → `weather-tips` Edge Function: check `weather_cache` (coords+date) → fetch Open-Meteo on miss → run rule engine over the user's plants (species + placement) → optionally LLM-phrase top signals → return ranked tips (+ cache).
- Tips render on dashboard/plant detail; high-severity signals schedule a local notification via the existing system.
- One-tap adjustment → updates the relevant `care_task.next_due_date` and re-syncs its reminder.

### Tip engine rules
- Signals are deterministic; the LLM only rephrases provided signals (no new advice).
- Indoor `placement` mutes direct-weather signals (rain) and emphasizes indirect ones (dry heating air, low light).
- `unknown` placement is treated as indoor (the safe default).
- Surface at most 1–3 tips/day; route only high-severity signals to notifications.
- Schedule changes are always user-confirmed.

### Edge cases and failure handling
- Location denied and no city set → hide weather surfaces gracefully; prompt for a city, don't error.
- Weather provider/Edge Function down → serve last cached snapshot; if none, show species-only guidance (current behavior) — never block the dashboard.
- LLM unavailable → render rule-template tips.
- Stale location (user travelled) → offer to refresh; don't silently use old coords for alerts.
- Conflicting signals (rain + heat) → rank by severity, show the more consequential.
- No plants yet → no tips; show the existing empty state.

### Verification checklist
- Frost case on an outdoor/cold-sensitive plant produces a frost tip and (if opted in) a notification.
- Rain case suppresses/defers a due watering via a one-tap action.
- Indoor tropical in heating season gets a dry-air/misting tip; indoor plants get no "rain" tips.
- Tips still render when the LLM call fails.
- Weather is cached and reused for nearby same-day requests.
- Manual-city path works with location permission denied.
- No surface is gated behind premium.

### Launch and operations notes
- Keep frost/heat thresholds adjustable; tune from feedback after launch.
- Monitor Edge Function error rate and Open-Meteo availability; cache TTL protects against blips.
- Watch the notification opt-out guardrail; if it rises, cut alert frequency.
- Confirm store privacy labels accurately describe coarse-location-for-weather use.

---

## Out of scope (this phase)
- Background location / continuous tracking.
- Hyperlocal microclimate modelling, soil-moisture sensors, or hardware integrations.
- Multi-location support per user (one active location to start).
- Historical weather analytics / "this winter was harsh on your plants" retrospectives (possible later).
- Premium gating (decided: free).

## Dependencies & risks
- **Risk — low location-permission grant rate.** Mitigation: benefit-framed contextual prompt + robust manual-city fallback; the feature must be useful without GPS.
- **Risk — notification fatigue.** Mitigation: rare, high-severity-only alerts; opt-in; track opt-out as a guardrail.
- **Risk — wrong/over-confident advice (esp. frost).** Mitigation: conservative thresholds, rules-only advice, LLM limited to phrasing.
- **Dependency — Open-Meteo availability** and the existing OpenAI Edge Function for phrasing.

## Open questions
- Default frost/heat thresholds and whether to localize them by hemisphere/season at launch or post-launch.
- Capture `light_exposure` in v1, or ship placement-only first and add exposure later?
- Should the daily tip refresh once each morning (with the 9 AM reminder cadence) or on every dashboard open within cache TTL?
