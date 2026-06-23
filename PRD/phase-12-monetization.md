# Phase 12 — Monetization & Premium Tier

**Goal:** Introduce a sustainable revenue model with a generous free tier and a non-intrusive premium upgrade — the competitive wedge against paywall-heavy incumbents.

**Requirements covered:** None directly (monetization is Phase 2 scope). Addresses the strategic "generous free tier" positioning from the PRD's market analysis.

**Depends on:** Phases 01–10 (shipped MVP), Phase 11 (streaks add value to premium).

**Phase type:** Fast follow (post-MVP).

---

## What gets built

### 1. Free tier vs. premium tier definition

The PRD's competitive wedge is a **generous, non-nagging free tier**. The free tier must be genuinely useful — not a crippled demo.

**v1 paywall — what ships in this phase.** Every feature below is already built; this phase only adds entitlement state and limit checks on top of existing functionality. We deliberately sell *only what exists* so a paying user never sees an advertised feature they can't use (also avoids App Store rejection for unavailable functionality).

| Feature | Free | Premium |
|---------|------|---------|
| Plant identification scans | 5 per day | Unlimited |
| Disease diagnosis scans | 3 per day | Unlimited |
| Plants in collection | 10 | Unlimited |
| Growth photo timeline | 1 photo/plant/month | Unlimited |
| Care scheduling & logging | Full | Full |
| Dashboard & notifications | Full | Full |
| Weather-aware care tips (Phase 14) | Full | Full |

**Key principle**: The core loop (scan → info → track → care) works fully on free. Premium adds volume, depth, and convenience — not gating of core features.

**Deferred premium features (NOT in this phase).** These were in earlier drafts but are not yet built, so they are excluded from the v1 paywall. Add them to the premium offering only once they ship, to avoid selling vaporware:

| Feature | Status | Where it lands |
|---------|--------|----------------|
| Advanced charts & full analytics | Not built (only the basic 8-week consistency chart + streak/weekly stats exist) | **Phase 15 — Advanced Analytics** (premium-gated) |
| Detailed care history export (PDF/CSV) | Not built | Future phase, bundle with or after Phase 15 |

Dropped entirely:
- **Priority scan processing** — a single-pipeline solo app can't honestly deliver a faster queue; a fake perk erodes trust. Replace with real depth (e.g. analytics) instead.
- **Ads** — already deferred in the tech notes; the brand wedge is calm, ad-free.

> **Build order (per product owner):** ship this phase's paywall + capping first and verify it works end-to-end; *then* build Phase 15 and add advanced analytics to the premium offering.

### 2. Subscription setup

- **Pricing**: One tier, monthly and annual options.
  - Suggested: $4.99/month or $29.99/year (~50% annual discount).
  - Research competitor pricing at implementation time — PictureThis and PlantIn charge $5-8/month.
- **Payment**: In-app purchase via Apple's StoreKit / Google Play Billing.
- **Library**: Use `expo-in-app-purchases` or `react-native-iap` for cross-platform IAP.

### 3. Entitlement checking

- Store subscription status in Supabase:
  ```sql
  create table subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade unique not null,
    plan text default 'free' check (plan in ('free', 'premium')),
    platform text check (platform in ('ios', 'android')),
    store_transaction_id text,
    expires_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
  ```
- On app launch, check subscription status:
  - Verify with the app store receipt (StoreKit / Google Play).
  - Update the `subscriptions` table if status has changed (expired, renewed, cancelled).
- Expose a `isPremium` flag in the app's auth context for feature gating.

### 4. Scan limit enforcement

- Track daily scan count per user, **separately for identify and diagnose** (they have different free limits — 5 vs. 3):
  - The existing `scan_events` table only records `scan_type = 'identify'` (its check constraint rejects anything else). To enforce the diagnosis cap you must **extend `scan_events` to accept `'diagnose'`** (update the `scan_type` check constraint) and write a `scan_events` row from the diagnosis flow, *or* count diagnosis runs another way (e.g. `care_logs` / a dedicated diagnosis table). Pick one source of truth per scan type and count "today" against it.
  - Or maintain a simple counter in `AsyncStorage` (reset daily) — but a server-side count is harder to bypass and survives reinstalls.
- When the free limit is reached:
  - Show a friendly message: "You've used your 5 free scans today. Upgrade to Leaflet Premium for unlimited scans."
  - **Do not block the screen.** Show the message inline with a "Maybe later" dismissal.
  - The "Upgrade" button navigates to the premium screen.

### 5. Collection limit enforcement

- When a free user tries to add an 11th plant:
  - Inline message: "Free accounts can track up to 10 plants. Upgrade for unlimited plants."
  - The user can still view and manage their existing 10 plants.

### 6. Premium upsell screen

- Accessible from:
  - Settings/Profile screen ("Upgrade to Premium").
  - Inline prompts when limits are hit.
  - **Never** a popup or interstitial — the PRD explicitly competes against "aggressive paywalls" and "frequent upgrade pop-ups."
- Screen content:
  - Clear comparison of free vs. premium features.
  - Monthly and annual pricing with the annual discount highlighted.
  - "Start free trial" if offering a trial (7-day trial recommended).
  - "Restore purchases" button for users who already subscribed.
  - Subscription terms and links to Apple/Google subscription management.

### 7. Restore purchases

- "Restore purchases" button in Settings and on the premium screen.
- Calls `expo-in-app-purchases` restore flow.
- Updates the `subscriptions` table if a valid subscription is found.
- Handles the case where a user re-installs or switches devices.

---

## Acceptance criteria

- [ ] Free users can scan up to 5 plants/day and diagnose up to 3/day.
- [ ] Free users can track up to 10 plants.
- [ ] Hitting a limit shows a friendly, dismissible message (not a blocking popup).
- [ ] The premium screen clearly shows the value proposition with pricing.
- [ ] Monthly and annual subscription options are available via IAP.
- [ ] Purchasing premium unlocks unlimited scans and collection size immediately.
- [ ] Subscription status persists across app restarts and syncs to Supabase.
- [ ] Expired subscriptions correctly revert to free tier limits.
- [ ] "Restore purchases" works for returning subscribers.
- [ ] No aggressive paywalls, popups, or interstitials — the upgrade path is always user-initiated or a gentle inline suggestion.

---

## Tech notes

- **IAP libraries**: `react-native-iap` is the most mature option for Expo (requires a dev client, not Expo Go). Alternatively, consider **RevenueCat** as a wrapper — it handles receipt validation, subscription management, and cross-platform entitlements out of the box. It has a free tier for small apps.
- **Receipt validation**: Don't trust the client. Validate receipts server-side in a Supabase Edge Function that calls Apple/Google verification endpoints. RevenueCat handles this automatically if used.
- **Subscription lifecycle**: Handle renewal, cancellation, grace period, and billing retry states. Apple and Google both have webhook systems for subscription events — set up a Supabase Edge Function endpoint to receive them.
- **Free tier generosity**: The limits above are starting suggestions. Adjust based on actual usage data post-launch. The goal is that most casual users never hit the limit — premium is for power users and collectors.
- **A/B testing pricing**: If you want to test different price points, use remote config (e.g., a Supabase table of config values fetched on app launch). This avoids app store updates for pricing changes.
- **Ads**: The table mentions "minimal, non-intrusive" ads on free. For the initial fast-follow, skip ads entirely — they add complexity and hurt the brand positioning. Revisit only if subscription revenue underperforms.

---

## Full implementation plan

### Implementation objective
Introduce a premium tier without weakening the core free product. Monetization should enforce generous usage limits, support reliable entitlement checks, and avoid aggressive paywall behavior.

### Ordered build tasks
1. Confirm the final free and premium limits before implementation, using the table in this phase as the default.
2. Choose the purchase infrastructure. RevenueCat is the recommended implementation default because it simplifies receipt validation, cross-platform entitlement sync, and restore purchases.
3. Create the `subscriptions` table and RLS/service access pattern if managing entitlements in Supabase.
4. Add entitlement fetch on app launch and expose `isPremium`, plan, expiry, and loading state through app context.
5. Add scan-limit checks before identify and diagnose submissions.
6. Add collection-limit checks before saving an 11th plant for free users.
7. Add growth-photo monthly limit checks if Phase 11 is already shipped.
8. Build a Premium screen reachable from Settings and inline limit messages.
9. Add purchase, restore purchases, and subscription status refresh flows.
10. Add server-side receipt validation or RevenueCat webhook handling before trusting premium access.
11. Add friendly, dismissible limit messages with "Maybe later" and "Upgrade" actions.
12. Avoid interstitials, forced popups, or blocking upgrade modals outside explicit limit moments.

### Expected files and modules
- Entitlement provider exposes subscription state to feature gates.
- Premium screen explains free vs premium clearly and shows monthly/annual options.
- Limit-check helpers are used by scan, diagnosis, collection save, and growth photo flows.
- Backend receipt/webhook function updates subscription state when purchases renew, expire, or are restored.
- Settings includes Upgrade and Restore Purchases entry points.

### Data and state flow
- App starts and fetches entitlement state from the purchase provider and/or Supabase.
- Feature flows call limit helpers before executing paid-volume actions.
- Free users within limits proceed normally.
- Free users over limits see an inline upgrade prompt and can dismiss it.
- Purchase completion refreshes entitlement state immediately.
- Restore purchases refreshes entitlement state for returning subscribers.
- Expired subscriptions revert to free limits after validation.

### Monetization behavior rules
- Core loop remains functional on free: identify, view info, save plants, schedule care, and receive reminders within limits.
- Upgrade prompts are contextual and user-friendly.
- Premium unlocks volume, convenience, and depth, not basic usability.
- Do not add ads in the first monetization implementation unless explicitly reprioritized.

### Edge cases and failure handling
- If entitlement fetch fails, default to the last known entitlement briefly, then safe free behavior with retry.
- If purchase succeeds but backend sync is delayed, show pending state and refresh entitlement.
- If restore finds no purchase, show a neutral message rather than an error.
- If app store APIs are unavailable, keep existing free functionality available.
- Server-side validation failures should not expose raw receipt details to the user.

### Verification checklist
- Free scan and diagnosis limits are enforced at the configured thresholds.
- Free collection limit blocks the 11th plant with a friendly inline message.
- Premium screen shows pricing, benefits, terms, and restore action.
- Purchase flow unlocks premium features after validation.
- Restore purchases works after reinstall or sign-in on another device.
- Expired subscription returns the user to free limits.
- No aggressive paywalls or interstitial upgrade prompts appear.

### Launch and operations notes
- Pricing should be verified against current competitors and app-store constraints before submission.
- App Store and Google Play product IDs must be documented outside source code where appropriate.
- RevenueCat or receipt validation webhooks should be monitored after launch.
- Usage limits should be adjustable later without an app release if remote config is added.
