# Phase 13 — RevenueCat Payments & Premium Entitlements

**Goal:** Implement the monetization contract defined in [Phase 12](phase-12-monetization.md) using **RevenueCat** as the single source of truth for purchases and entitlements — so the app can sell a non-intrusive premium subscription with reliable cross-platform receipt validation, restore, and renewal handling, without hand-rolling StoreKit / Play Billing.

**Requirements covered:** Operationalizes Phase 12 (monetization). No new product FR — this is the engineering implementation of the premium tier.

**Depends on:** Phases 01–10 (shipped MVP), Phase 02 (auth — RevenueCat app user id is aligned to the Supabase user id), Phase 12 (free/premium tier definition and limit UX). Phase 11 (streaks) optional.

**Phase type:** Fast follow (post-MVP). Requires a dev client / native build — **not Expo Go compatible**. The project already ships `expo-dev-client` and an Android prebuild, so this fits.

**Relationship to Phase 12:** Phase 12 is the *product contract* (what's free, what's premium, the no-nagging rule). This phase is the *implementation contract* and **supersedes Phase 12's library guidance** (`react-native-iap` / `expo-in-app-purchases`): we commit to RevenueCat.

---

## 1. Problem & why now

The MVP has no revenue. Phase 12 settled the positioning — a genuinely generous free tier with a calm, user-initiated upgrade — but left the purchase infrastructure open. We need a payment path before we can ask for money, and the riskiest parts of IAP (server-side receipt validation, renewal/expiry/grace-period state, cross-device restore, two stores with different APIs) are exactly what RevenueCat removes. Building these by hand as a solo developer is weeks of error-prone work and an ongoing maintenance liability. RevenueCat collapses it to one SDK + a webhook and has a free tier that covers a small app's revenue.

## 2. Target users

- **Primary — the plant collector / power user:** tracks more than 10 plants, scans frequently, hits the free limits naturally. The person premium is *for*.
- **Secondary — the casual keeper:** should rarely or never hit a limit and should never feel nagged. Premium must stay invisible to them.
- **Internal — solo developer:** needs purchases to "just work" across iOS/Android with minimal backend surface to operate.

## 3. Success metrics

- **Primary:** Free → premium conversion rate (target: establish a baseline; ≥1–2% of active users is a healthy starting point for a utility app).
- **Secondary:** Trial-start rate and trial→paid conversion (if a trial is offered); annual vs monthly mix; restore success rate.
- **Guardrail (must not regress):** Day-7 / Day-30 retention and free-tier activation. If retention drops after launch, the upgrade path has become intrusive — back it off.
- **Operational:** Webhook delivery success rate; entitlement-sync lag (purchase → `isPremium` true).

---

## What gets built

### 1. RevenueCat project & store product setup

- Create a RevenueCat project; add the iOS and Android apps.
- Configure store products **first in the stores**, then map them in RevenueCat:
  - App Store Connect: auto-renewable subscription group with `leaflet_premium_monthly` and `leaflet_premium_annual`.
  - Google Play Console: a subscription with monthly and annual base plans.
- In RevenueCat:
  - **Entitlement:** `premium` (the one thing the app checks).
  - **Offering:** `default` containing a `$rc_monthly` and `$rc_annual` package, both attached to the `premium` entitlement.
  - Optional **7-day introductory free trial** on both base plans (recommended per Phase 12).
- Pricing per Phase 12: ~$4.99/month or ~$29.99/year. **Confirm against current competitors and store price tiers at implementation time.**

### 2. SDK integration (`react-native-purchases`)

- Add `react-native-purchases` (and optionally `react-native-purchases-ui` for a prebuilt paywall — see §6).
- Configure once at app launch, after the native layer is ready, with **public SDK keys** per platform:
  - `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` added to `lib/env.ts` (these are publishable keys — safe in the client; the webhook secret is **not**).
- **Identity alignment:** call `Purchases.logIn(supabaseUserId)` once the Supabase session is known, and `Purchases.logOut()` on sign-out. This ties the RevenueCat "app user" to our `auth.users` id so webhooks and cross-device restore resolve to the right account.

### 3. Entitlement provider (app-wide premium state)

- A React context/provider that exposes: `isPremium`, `plan` (`'free' | 'premium'`), `expiresAt`, `isLoading`, `offerings`, and actions `purchase(pkg)`, `restore()`, `refresh()`.
- Source of truth order: RevenueCat `CustomerInfo.entitlements.active['premium']`. Subscribe with `Purchases.addCustomerInfoUpdateListener` so renewals/expiries update the UI live.
- Mirror the resolved state into Supabase `subscriptions` (via the webhook, §7) so other surfaces and any server logic can read entitlement without the SDK.

### 4. Feature gating (consume Phase 12 limits)

Reuse the limit-check helpers from Phase 12; this phase wires them to real entitlement:
- **Scans:** 5 identify/day, 3 diagnose/day on free → unlimited on premium.
- **Collection:** 10 plants on free → unlimited on premium.
- **Growth photos:** 1/plant/month on free → unlimited (if Phase 11 shipped).
- Gating reads `isPremium` from the provider. When over a limit and not premium, show the **inline, dismissible** prompt (never a blocking interstitial) — exactly as Phase 12 specifies.

> **Note:** Weather-aware care tips (Phase 14) are **fully free** and are *not* gated by this phase. Do not add `premium` checks to the weather feature.

### 5. Purchase, restore, and refresh flows

- **Purchase:** `getOfferings()` → present packages → `purchasePackage()` → on success, entitlement updates via listener; show confirmation; immediately unlock gated features.
- **Restore:** `restorePurchases()` from Settings and the premium screen → refresh entitlement → neutral message if nothing is found (not an error).
- **Refresh:** `getCustomerInfo()` on app foreground and after sign-in to catch server-side changes (renewals, cancellations, refunds).

### 6. Premium / upgrade screen

- A single screen reachable from **Profile/Settings** and from **inline limit prompts** — never a popup or launch interstitial.
- Content: clear free-vs-premium comparison (reuse Phase 12 table), monthly + annual options with the annual discount highlighted, trial CTA if offered, **Restore purchases**, and links to subscription terms + store-managed cancellation.
- Implementation choice: either build a custom screen against `getOfferings()` (full control of the calm, on-brand design) or use a RevenueCat paywall template via `react-native-purchases-ui`. **Recommended: custom**, because the brand's whole wedge is *not* looking like an aggressive paywall.

### 7. Server-side truth: RevenueCat webhook → Supabase

- Create the `subscriptions` table from Phase 12 (add a `rc_app_user_id` and `entitlement` column; keep `plan`, `platform`, `store_transaction_id`, `expires_at`).
- A **Supabase Edge Function** (`revenuecat-webhook`) receives RevenueCat events (`INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE`, `PRODUCT_CHANGE`, etc.):
  - Verify the shared `Authorization` secret header (`REVENUECAT_WEBHOOK_SECRET`, server-only).
  - Upsert the `subscriptions` row keyed by the Supabase user id (resolved from the RevenueCat app user id) with current `plan`/`expires_at`.
- The client never writes entitlement to Supabase — the webhook is the writer; the SDK is the live client read. This keeps premium honest even if the client is tampered with.

---

## Acceptance criteria

- [ ] RevenueCat is configured with a `premium` entitlement and a `default` offering containing monthly + annual packages mapped to live store products.
- [ ] On launch with a signed-in user, the app calls `Purchases.logIn(supabaseUserId)`; sign-out calls `logOut()`.
- [ ] The entitlement provider exposes `isPremium`, `plan`, `expiresAt`, `isLoading`, `offerings`, `purchase`, `restore`, `refresh`, and updates live via the customer-info listener.
- [ ] Purchasing premium unlocks unlimited scans, collection, and growth photos immediately (no app restart).
- [ ] Hitting any free limit shows a friendly, dismissible inline prompt — no blocking popups or launch interstitials anywhere in the app.
- [ ] The premium screen shows the free-vs-premium comparison, monthly + annual pricing with the annual saving highlighted, restore, and terms/links.
- [ ] Restore purchases works after reinstall and on a second device signed into the same account; a no-purchase result shows a neutral message.
- [ ] The `revenuecat-webhook` Edge Function verifies its secret and keeps the `subscriptions` table in sync on purchase, renewal, cancellation, and expiry.
- [ ] An expired/cancelled subscription reverts the user to free limits after the customer-info refresh.
- [ ] Public SDK keys live in `EXPO_PUBLIC_*` env; the webhook secret is server-only and never bundled.
- [ ] Sandbox purchases succeed on both iOS (sandbox tester) and Android (license tester / internal track).
- [ ] Weather-aware tips (Phase 14) remain fully accessible to free users.

---

## Tech notes

- **Why RevenueCat:** it owns receipt validation, cross-platform entitlement unification, restore, renewal/grace/billing-retry state, and webhooks — the parts most likely to break and hardest to test by hand. Free up to a revenue threshold that a launching app won't exceed.
- **Native build required:** `react-native-purchases` needs a dev client / prebuild (already in place). Plan a fresh build when adding the dependency.
- **Don't trust the client for anything that matters server-side.** The SDK is fine for *showing* premium UI instantly; the `subscriptions` table (fed by the webhook) is the durable record.
- **Identity:** always `logIn` with the Supabase user id *before* checking entitlements, or anonymous purchases won't merge cleanly when the user signs in. Handle the alias/merge case RevenueCat documents.
- **Offline / fetch failure:** if `getCustomerInfo()` fails, use the last cached `CustomerInfo` (the SDK caches it) and retry; degrade to safe free behavior rather than locking the app.
- **Pricing changes without a release:** RevenueCat offerings are remote-configurable, so price/package experiments don't need an app update — satisfies Phase 12's A/B-pricing note natively.
- **No ads** in this phase, per Phase 12.
- **Use Context7** to pull current `react-native-purchases` (Expo) setup, `Purchases.configure`/`logIn` signatures, and the latest webhook event schema at implementation time — the SDK and event payloads evolve.

---

## Full implementation plan

### Implementation objective
Ship a reliable, calm premium subscription using RevenueCat as the entitlement source of truth, wired to Phase 12's limit UX, with a Supabase-backed durable record fed by webhooks.

### Ordered build tasks
1. Create the RevenueCat project; register iOS + Android apps and store credentials.
2. Create store products (App Store Connect subscription group; Play subscription base plans), then map them in RevenueCat with the `premium` entitlement and `default` offering.
3. Add `react-native-purchases` (+ optionally `-ui`); rebuild the dev client.
4. Add public SDK keys to `lib/env.ts` and a config issue helper, mirroring the existing Supabase/Google env pattern.
5. Configure the SDK at launch; wire `logIn`/`logOut` to the Supabase auth lifecycle.
6. Build the entitlement provider with the customer-info listener and `refresh` on foreground/sign-in.
7. Connect Phase 12 limit helpers to `isPremium` for scans, collection, and growth photos.
8. Build the premium screen (custom, on-brand) from `getOfferings()`; add Settings + inline-prompt entry points.
9. Implement purchase, restore, and confirmation flows with optimistic unlock on success.
10. Create the `subscriptions` table changes and the `revenuecat-webhook` Edge Function with secret verification.
11. Test the full lifecycle in sandbox: purchase, renew, cancel, expire, restore, second-device, refund.
12. Verify no interstitials/popups exist and that free retention paths are untouched.

### Expected files and modules
- `lib/env.ts` — add RevenueCat public keys + config-issue helper.
- `lib/payments/revenuecat.ts` — SDK init, login/logout, offerings, purchase, restore, customer-info mapping.
- A premium/entitlement context provider exposing `isPremium` and actions.
- Premium screen route (under `app/(auth)/…`) reachable from Profile and inline prompts.
- Limit-check helpers (from Phase 12) consumed by scan, diagnosis, collection-save, and growth-photo flows.
- `subscriptions` table migration + `supabase/functions/revenuecat-webhook` Edge Function.
- Settings additions: Upgrade and Restore Purchases entry points.

### Data and state flow
- App launches → SDK configures → if signed in, `logIn(supabaseUserId)` → `getCustomerInfo()` populates the provider.
- Customer-info listener pushes renewal/expiry/cancellation changes into `isPremium` live.
- Feature flows call limit helpers; free-over-limit shows an inline upgrade prompt; premium proceeds unlimited.
- Purchase success → listener flips `isPremium` → gated features unlock immediately.
- RevenueCat → `revenuecat-webhook` → upsert `subscriptions` (durable server record).
- Restore → refresh entitlement; expired → revert to free after refresh.

### Monetization behavior rules
- Core loop stays fully functional on free within limits (identify, info, save, schedule, reminders).
- Upgrade prompts are contextual, dismissible, and user-initiated — never interstitials or launch popups.
- Premium unlocks volume/convenience/depth, never basic usability.
- Weather-aware tips (Phase 14) are free and untouched by gating.

### Edge cases and failure handling
- Entitlement fetch fails → use cached `CustomerInfo`, retry, degrade to safe free.
- Purchase succeeds but webhook/sync lags → trust the SDK for instant unlock; reconcile `subscriptions` when the webhook lands.
- Restore finds nothing → neutral message, not an error.
- Store APIs unavailable → keep existing free functionality available.
- Anonymous purchase before sign-in → handle RevenueCat identity merge on `logIn`.
- Webhook with bad/missing secret → reject; never write entitlement from unauthenticated callers.

### Verification checklist
- Sandbox purchase unlocks premium instantly on iOS and Android.
- Renewal, cancellation, and expiry events flip entitlement correctly.
- Restore works on reinstall and second device.
- Free limits enforce at the configured thresholds; premium removes them.
- No interstitials/popups anywhere; upgrade is always user-initiated or a gentle inline suggestion.
- `subscriptions` table reflects webhook events; client never writes entitlement.
- Weather tips remain available to free users.

### Launch and operations notes
- Document store product IDs and RevenueCat keys outside source where appropriate.
- Monitor webhook delivery and entitlement-sync lag after launch.
- Verify pricing against current competitors and store tiers before submission.
- Keep offerings remote-configurable so pricing/packaging can change without an app release.

---

## Out of scope (this phase)
- Ads (explicitly deferred in Phase 12).
- Promo codes / referral discounts / family sharing nuances (later, if demand appears).
- Gating the weather feature (decided: weather tips are free).
- In-app price A/B experiments (the offering infra supports it; running experiments is a later activity).

## Dependencies & risks
- **Store setup latency:** App Store / Play subscription approval and tax/banking setup can take days — start early.
- **Build dependency:** new native module → fresh dev-client build required.
- **Risk — intrusive monetization erodes the brand wedge.** Mitigation: hard rule of no interstitials; track retention as a guardrail.
- **Risk — entitlement desync between SDK and Supabase.** Mitigation: webhook is the writer, SDK is the live read, foreground refresh reconciles.

## Open questions
- Offer a 7-day trial at launch, or introduce it after a conversion baseline exists?
- Final price points and annual discount % (confirm vs competitors at build time).
- Should any *future* premium-only surface live behind this entitlement, or keep premium purely volume/convenience as Phase 12 frames it?
