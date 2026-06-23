# Phase 15 — Advanced Charts & Full Analytics (Premium)

**Goal:** Give power users a genuine *depth* reason to be premium — a rich, multi-dimensional view of their plant care history (per-plant trends, all care types, longer history, health over time) that goes well beyond the free dashboard's single 8-week water-consistency chart. This is the first **premium-only feature surface** (not just a volume cap), and it is gated behind the `premium` entitlement.

**Requirements covered:** None directly. Operationalizes the "Advanced charts & full analytics" premium row deferred out of [Phase 12](phase-12-monetization.md), and gives [Phase 13](phase-13-revenuecat-payments.md)'s entitlement a depth feature to unlock.

**Depends on:** Phases 01–10 (shipped MVP), Phase 07 (care scheduling/logging — the data source), Phase 09 (dashboard — the existing basic stats this extends), **Phase 13 (RevenueCat entitlement — the gate)**. Phase 11 (growth photos) optional but enriches the analytics. Phase 14 (weather) optional cross-reference.

**Phase type:** Feature phase (post-paywall). Build **after** Phase 12's paywall + capping is shipped and verified, per the product owner's build order. Pure data/UI work — no new native modules, so no fresh dev-client build required.

**Relationship to Phase 12/13:** Phase 12 deferred this feature out of the v1 paywall because it wasn't built. Phase 13 ships the `premium` entitlement. This phase builds the feature **and** adds it to the premium offering — it is the first thing premium unlocks beyond raw volume.

---

## 1. Problem & why now

The free dashboard already shows a basic chart (8-week water-consistency line) plus a care streak and weekly completion rate (`lib/api/careStats.ts`, `lib/api/dashboard.ts`, `components/illustrations/LineChart.tsx`). That's enough to feel progress but not enough to *analyze* it. A collector with 10+ plants and months of logs has no way to ask: "Which plants do I neglect? Is my fertilizing slipping? Is my collection getting healthier over time? When am I most consistent?"

Phase 12 intentionally sells only volume in v1. But volume caps alone convert price-sensitive power users weakly — there's no aspirational, *only-on-premium* reason to upgrade for someone who happens to stay under the caps. Analytics is that reason: it rewards exactly the engaged, data-rich users who are most likely to pay, and it's honest depth rather than an artificial limit. Now is the right time because the paywall infrastructure (entitlement, premium screen, inline prompts) exists after Phase 13, and the care-log data has accumulated.

## 2. Target users

- **Primary — the data-loving collector:** months of care logs across many plants; wants per-plant and per-care-type insight, trends, and "best/worst" framing. The person this feature converts.
- **Secondary — the improving beginner:** uses the health-over-time and consistency views as motivation; a soft upsell target who upgrades when they want the fuller picture.
- **Excluded — the casual keeper:** still gets the free basic chart + streak; never pushed into analytics. Premium stays invisible to them (Phase 12 rule).

## 3. Success metrics

- **Primary:** Analytics-driven conversion — share of premium upgrades whose last pre-purchase screen was the analytics teaser/locked state.
- **Secondary:** Premium engagement — % of premium users who open the analytics screen weekly; depth of interaction (date-range / per-plant toggles used).
- **Guardrail (must not regress):** Free dashboard performance and the existing basic chart stay exactly as-is for free users; no analytics work slows the home screen.
- **Operational:** Analytics query latency on large histories (months of logs, many plants) stays acceptable on-device.

---

## What gets built

### 1. Premium-gated analytics screen

- A dedicated **Analytics** (or "Insights") screen reachable from the dashboard/home and from Profile.
- For **free users**, the entry point is visible but the screen shows a **locked/teaser state**: a blurred or sample preview of the richer charts plus the standard Phase 12 inline upgrade prompt ("See your full care history and per-plant trends with Premium"). This is the *only* place a premium-only surface is teased — still no interstitials, still dismissible, still user-initiated to open.
- For **premium users**, the full analytics render.
- Gating reads `isPremium` from the Phase 13 entitlement provider. Never hard-block navigation — show the teaser, not a wall.

### 2. Analytics computations (extend the existing stats layer)

Build on `lib/api/careStats.ts` and `lib/api/dashboard.ts` rather than replacing them. New premium computations:

- **Per-care-type consistency** — completion rate over time for *every* completable care type (water, fertilize, repot, prune, rotate, mist), not just water. Free's chart is water-only; premium breaks it out per type.
- **Per-plant care performance** — completion rate / overdue frequency per plant; surface "most cared for" and "most neglected" plants.
- **Selectable history ranges** — e.g. 4 weeks / 12 weeks / 6 months / all time. Free is fixed at 8 weeks; premium can zoom out across the full log history.
- **Collection health over time** — trend of `healthPercentage` (or healthy-plant count) across the selected range, so users see whether their collection is improving.
- **Care-type distribution** — breakdown of logged care actions by type (how the user actually spends their care effort).
- **Streak history / longest streak** — extend the existing current-streak calc with longest-ever streak and a streak timeline.
- (If Phase 11 shipped) **Growth-photo cadence** — how often the user documents growth per plant.

> Keep these as pure functions over the already-fetched `CareLog` / `CareTask` / `SavedPlant` data where possible, mirroring `calculateCareStats`. The dashboard already fetches a wide log window (`RECENT_WEEKS`/`STREAK_LOOKBACK_DAYS`); analytics may need a longer fetch — make the range explicit and only fetch the longer window when the premium screen actually opens.

### 3. Charts & visualizations

- Reuse and extend `components/illustrations/LineChart.tsx` for trend lines (it already renders 0–100 value series with labels). Add the chart types the new computations need (multi-series / per-type lines, a simple bar or distribution view, a per-plant ranked list). Match the existing design system (no `fontWeight: 900`, use theme tokens and the shared card/chart primitives — see the design-system convention).
- Clear empty/low-data states: a user with little history should see "Keep logging care to unlock richer trends," not broken charts.

### 4. Add analytics to the premium offering

- Update the **premium/upgrade screen** (Phase 13 §6) and the Phase 12 comparison table to include "Advanced charts & full analytics" as a premium benefit — now that it actually exists.
- The analytics teaser's upgrade CTA routes to the same premium screen; on successful purchase the entitlement listener flips `isPremium` and the analytics render immediately (no restart), consistent with Phase 13's optimistic unlock.

### 5. No backend gate required

- Entitlement is the gate; analytics read the user's own `care_logs` / `care_tasks` / `user_plants` (already RLS-protected per user). No new table or Edge Function is required for v1 — computations run client-side over data the user already owns. (If performance on very large histories becomes an issue later, consider a materialized summary, but that's out of scope here.)

---

## Acceptance criteria

- [ ] An Analytics/Insights screen exists, reachable from the dashboard and Profile.
- [ ] Free users see a locked teaser state with a dismissible, user-initiated upgrade prompt — never a blocking interstitial.
- [ ] Premium users see full analytics: per-care-type consistency, per-plant performance, selectable history ranges, collection-health-over-time, care-type distribution, and streak history.
- [ ] The free dashboard's existing basic chart, streak, and weekly stats are unchanged for free users.
- [ ] Charts use the existing design system / theme tokens and the extended `LineChart` (no regressions to the home chart).
- [ ] Gating reads `isPremium` from the Phase 13 entitlement provider; purchasing premium unlocks analytics immediately without a restart.
- [ ] The premium screen and Phase 12 comparison table list advanced analytics as a premium benefit.
- [ ] Low/no-data states render gracefully (guidance, not broken charts).
- [ ] Opening analytics does not slow the home screen; the longer history fetch happens only when the analytics screen opens.
- [ ] No new "premium" checks leak into free surfaces (weather, basic dashboard, core loop remain free per Phase 12).

---

## Tech notes

- **Extend, don't fork.** `calculateCareStats` and `buildConsistencyWeeks` already encode the streak/consistency logic and the per-task-key model — generalize them (per-type, per-plant, parameterized range) rather than writing a parallel engine.
- **Data source:** all inputs are `care_logs` (with `task_type`), `care_tasks`, and `user_plants`, already RLS-scoped to the user. No new permissions needed.
- **Fetch window:** the dashboard fetches `max(RECENT_WEEKS*7, STREAK_LOOKBACK_DAYS)` days. "All time" / 6-month ranges need a deliberately larger query — gate that fetch behind the analytics screen opening and behind `isPremium` so free users never pay the cost.
- **Charts:** `LineChart` takes `values: number[]` (0–100) + `labels`. Multi-series and distribution views are straightforward extensions in `react-native-svg`, which is already a dependency.
- **Gating honesty:** this is depth, not a volume wall — there's no per-day counter here. The only check is `isPremium`. Keep the teaser generous enough to convey value (sample/blurred real-looking data), never deceptive.
- **Performance:** computations are pure and client-side; memoize per fetched dataset. Watch large-collection × long-range combos; if it ever stalls, precompute a summary table later (out of scope now).
- **Use Context7** for current `react-native-svg` chart APIs if adding new chart primitives.

---

## Full implementation plan

### Implementation objective
Ship the first premium-only depth feature: a rich analytics screen gated by the Phase 13 `premium` entitlement, built by generalizing the existing stats layer, with a calm teaser for free users and instant unlock on purchase.

### Ordered build tasks
1. Confirm Phase 12 paywall + capping and Phase 13 entitlement are shipped and verified (this phase's gate depends on them).
2. Generalize `calculateCareStats` / `buildConsistencyWeeks` into parameterized computations: per-care-type, per-plant, selectable range, health-over-time, distribution, streak history.
3. Add an analytics data fetch that pulls the longer history window, invoked only when the analytics screen opens.
4. Extend `LineChart` (and add a bar/distribution + ranked-list view) within the existing design system.
5. Build the Analytics screen: premium full state + free locked/teaser state.
6. Wire `isPremium` from the Phase 13 entitlement provider to switch between teaser and full; route the teaser CTA to the premium screen.
7. Add the Analytics entry point to the dashboard and Profile.
8. Add "Advanced charts & full analytics" to the premium screen and the Phase 12 comparison table.
9. Verify instant unlock on purchase, graceful low-data states, and no home-screen regression.

### Expected files and modules
- `lib/api/careStats.ts` — generalized computations (or a new `lib/api/analytics.ts` that builds on it) for per-type / per-plant / ranged / health-over-time / distribution / streak-history.
- An analytics data fetcher (extend `lib/api/dashboard.ts` or a new `lib/api/analytics.ts`) for the longer history window.
- `components/illustrations/LineChart.tsx` — extended; plus any new chart components for distribution / ranked lists.
- An Analytics screen route under `app/(auth)/…` with premium and teaser states.
- Entry points from the dashboard/home and Profile.
- Premium screen + Phase 12 table updated to list analytics.

### Data and state flow
- User opens Analytics → check `isPremium`.
- Free → render teaser (sample/blurred) + dismissible upgrade prompt → CTA to premium screen.
- Premium → fetch longer history → run pure computations → render full charts; user toggles range / per-plant views.
- Purchase success (from teaser CTA) → entitlement listener flips `isPremium` → analytics render immediately.

### Monetization behavior rules
- Analytics is premium-only depth, not a capped free feature — the only gate is `isPremium`, no daily counters.
- Teaser is user-initiated (they open the screen), dismissible, and never an interstitial — consistent with Phase 12/13.
- Free dashboard depth (basic chart, streak, weekly rate) is untouched and stays free.
- Weather, core loop, and existing free surfaces gain no new gates.

### Edge cases and failure handling
- Sparse/no history → guidance empty states, not broken charts.
- Entitlement fetch fails → fall back to teaser (safe free behavior), retry, never crash the screen.
- Very large history × long range → memoize; if it stalls, degrade to a shorter default range rather than blocking.
- New plant with no logs → excluded from per-plant performance gracefully.

### Verification checklist
- Free user sees teaser + dismissible upgrade; premium user sees full analytics.
- All premium computations render correctly across a realistic multi-plant, multi-month dataset.
- Purchasing from the teaser unlocks analytics instantly (no restart).
- Free dashboard chart/streak/stats are byte-for-byte unchanged.
- Premium screen and Phase 12 table list analytics.
- No premium checks leak into free surfaces; home screen performance unaffected.

### Launch and operations notes
- Monitor analytics-driven conversion and premium analytics engagement.
- Watch on-device computation time for power users; consider a precomputed summary only if needed.
- Keep the teaser honest and compelling; iterate copy/preview based on conversion.

---

## Out of scope (this phase)
- Care history export (PDF/CSV) — separate deferred premium feature; bundle with or after this phase.
- Server-side precomputed analytics / materialized summaries (only if client performance forces it later).
- Cross-user benchmarking or social comparison.
- Predictive/AI insights beyond descriptive analytics.

## Dependencies & risks
- **Hard dependency on Phase 13 entitlement** — without `isPremium`, there is no gate. Do not start the gated screen before Phase 13 ships.
- **Risk — analytics feels thin and doesn't convert.** Mitigation: ground every chart in real user data the free tier can't show (per-plant, per-type, long range); make the teaser preview compelling.
- **Risk — performance on large histories.** Mitigation: lazy-fetch on screen open, memoize pure computations, degrade range before blocking.
- **Risk — scope creep into a BI tool.** Mitigation: ship the descriptive set above; defer export, benchmarking, and predictions.

## Open questions
- Which exact history ranges to offer (4w / 12w / 6m / all) and the default for premium?
- Teaser style: blurred real data vs. labeled sample data — which converts better without feeling deceptive?
- Should the analytics entry point appear for free users at all, or only surface after they hit a volume limit (to keep the casual tier even calmer)?
