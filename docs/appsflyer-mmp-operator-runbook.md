# Fernly iOS AppsFlyer MMP Operator Runbook

App: Fernly (`id6775880316`)
Bundle ID: `com.countrybean.leaflet`
Scope: iOS, global including EEA/UK, no ATT prompt, no IDFA
Last live audit: July 29, 2026

## Connected systems and verified starting state

- Fernly Supabase MCP is connected to project `gnrjqqoidzuwzvhhfggh`; local `supabase/config.toml` matches.
- RevenueCat MCP is connected to Fernly project `proj5d66023c`, iOS app `app223a460466`.
- RevenueCat already has the `Supabase subscriptions sync` webhook (`whintgr32f9f192df`) for initial purchase, renewal, product change, cancellation, billing issue, uncancellation, transfer, expiration, and subscription extension.
- AppsFlyer Fernly app is active with Advanced Privacy and probabilistic modeling enabled.
- AppsFlyer live audit found no in-app events, OneLink templates, active cost integrations, ad-revenue integrations, APNs certificate, or re-engagement configuration.
- RevenueCat SDK feature-gate inspection is unavailable to the connected MCP token (`project_configuration:sdk_compatibility:read` is missing). The AppsFlyer attribution integration is not exposed by the RevenueCat MCP.

Dashboard-only changes below remain release blockers until an operator records the owner, account, selected postbacks, windows, and verification date.

## Build-time configuration

Set these in the development/production build environment, never in Git:

```text
EXPO_PUBLIC_APPSFLYER_DEV_KEY
EXPO_PUBLIC_APPSFLYER_IOS_APP_ID=6775880316
EXPO_PUBLIC_APPSFLYER_ONELINK_DOMAIN
EXPO_PUBLIC_APPSFLYER_ONELINK_TEMPLATE_ID
```

Server-only Supabase secrets:

```text
APPSFLYER_OPENDSR_API_TOKEN
```

The OpenDSR value is the AppsFlyer V2 API token and must never be used in the app or committed. Existing Supabase service-role credentials remain server-only.

## First-party measurement consent

Fernly uses a built-in, globally displayed measurement choice rather than a
paid CMP. It has one optional category covering Firebase Analytics and
AppsFlyer attribution. Essential account, plant, AI, subscription, security,
and deletion services do not depend on this choice.

1. Show the choice before Firebase or AppsFlyer starts.
2. Store the choice, policy version, and decision time on the installation.
3. On acceptance, send AppsFlyer manual consent with data usage and storage
   allowed, ad personalization denied, and GDPR treated as applicable.
4. On rejection or withdrawal, keep Firebase disabled, stop AppsFlyer, block
   AppsFlyer partner sharing, and keep RevenueCat's AppsFlyer sharing filter.
5. Discard pre-consent events; never buffer or replay them.
6. Allow withdrawal and re-consent from Profile > Privacy choices.
7. Validate accept, reject, reopen, withdraw, policy-version re-prompt, and
   re-consent on a physical iPhone.

This implementation does not generate an IAB TCF string. Do not enable AdMob
or other publisher advertising that requires a certified CMP without a fresh
privacy and partner-policy review.

## OneLink

Create one hosted OneLink template and set its host/template ID in the build environment. The app accepts only:

```text
deep_link_value=home
deep_link_value=scan&deep_link_sub1=identify
deep_link_value=scan&deep_link_sub1=diagnose
deep_link_value=premium
deep_link_value=activation
```

The OneLink domain must be an HTTPS `*.onelink.me` hostname. Expo adds it as `applinks:<host>`. Unknown values, URLs, routes, oversized values, and invalid scan modes fall back to home. Fernly persists only the parsed intent plus direct/deferred state, consumes it once after authentication/onboarding, and expires it after 24 hours.

## RevenueCat to AppsFlyer

1. Confirm the RevenueCat plan includes the AppsFlyer attribution integration.
2. Enable the Fernly AppsFlyer integration for sandbox and production.
3. Map RevenueCat events:
   - trial start → `af_start_trial`
   - initial paid subscription → `af_subscribe`
   - trial conversion, renewal, cancellation, uncancellation, billing issue, expiration, product change, refund → descriptive custom event names without the reserved `af_` prefix
4. Send gross subscription revenue and currency from RevenueCat.
5. Do not configure AppsFlyer Purchase Connector or client-side revenue events.
6. Confirm the `$appsflyerSharingFilter` customer attribute is `"all"` before
   consent and after withdrawal, and absent only while measurement consent is
   granted.
7. Reconcile RevenueCat gross revenue with AppsFlyer; keep estimated net proceeds only in RevenueCat/Data Locker exports.

The app synchronizes `$appsflyerId` after consent and retries immediately before
purchase without blocking StoreKit if synchronization fails. It also applies
RevenueCat's documented `$appsflyerSharingFilter=all` opt-out before consent and
after withdrawal so RevenueCat's server-side lifecycle postbacks cannot be
shared with AppsFlyer partners. It never collects or sets IDFA.

## SKAN and AdAttributionKit

The generated Info.plist must contain:

```text
NSAdvertisingAttributionReportEndpoint=https://appsflyer-skadnetwork.com/
AdAttributionKit=https://appsflyer-skadnetwork.com/
EligibleForAdAttributionKitReengagementPostbackCopies=true
```

AppsFlyer exclusively manages conversion values. Do not add another SDK or native conversion-value updater.

Configure SKAN 4 Flexible mode in Conversion Studio:

- Days 0–2: onboarding → successful scan → first plant → paywall → checkout success.
- Days 3–7: retained session/care activity → trial/paid state.
- Days 8–35: retained care activity → paid/renewed state.

Keep Advanced Privacy and probabilistic modeling enabled. Enable re-engagement with a minimum seven-day interval. Change loyal-user classification from three sessions to the `first_plant_saved` milestone.

## Uninstall measurement

Fernly registers the native APNs device token with AppsFlyer after consent. This is independent of notification alert authorization.

1. Create a production APNs `.p12` certificate for `com.countrybean.leaflet`.
2. Upload it in AppsFlyer.
3. Validate sandbox and production separately.
4. Never commit the `.p12` or its password.

## Partner integration record

| Partner | Connected account | Owner | Required settings | Verification |
|---|---|---|---|---|
| Apple Ads | pending confirmation | pending | attribution, impression/click reporting, privacy-compatible retargeting, cost if ROI360 licensed | not verified |
| Meta | Fernly Meta App ID pending confirmation | pending | AMM terms, 7-day click, 1-day view, SKAN, consent-aware advanced sharing | not verified |
| Google Ads | account must be created | pending | register iOS app, activate `googleadwords_int`, selected conversions, DMA consent, cost if licensed | blocked on account |

AppsFlyer retains all mirrored Fernly events. Partners receive installs, canonical funnel conversions, and approved RevenueCat subscription lifecycle/revenue postbacks only. Do not enable user-level audiences or IDFA-dependent retargeting.

Live paid attribution and cost reconciliation remain unverified until an authorized campaign produces a click, install, canonical conversion, and cost row.

## OpenDSR deletion worker

Account deletion creates a held `appsflyer_erasure_requests` row before any destructive step, releases it only after storage cleanup, and requires release before deleting the Supabase user. The worker uses AppsFlyer’s official OpenDSR endpoint and one identity per request, preferring AppsFlyer UID and falling back to the Supabase CUID. Completed rows erase both provider identifiers.

### Production deployment blocker found July 29, 2026

The migration and both Edge Functions are implemented locally but are not
deployed. The linked Supabase project has pre-existing migration-history drift:

- remote-only: `20260530121400`, `20260530121607`, `20260530141759`
- local-only: `20260530154500`, `20260530163230`, `20260530164010`

`supabase db push --dry-run` refuses the new migration unless `--include-all`
is used. Do not force that flag: the older local migrations contain
non-idempotent schema creation and may duplicate production objects. Repair or
reconcile the migration history first, rerun the dry-run, then deploy the
OpenDSR migration and functions together. Until that is complete, do not deploy
the modified `delete-account` function because it deliberately requires the
queue table before deleting a user.

After deploying the migration and functions:

1. Set `APPSFLYER_OPENDSR_API_TOKEN` with Supabase secret management.
2. Schedule `process-appsflyer-erasure` at least hourly using a service-role-authenticated invocation stored in Supabase Vault.
3. Alert on `appsflyer_opendsr_deadline_at_risk`.
4. Alert on rows in `failed`, retries that stop advancing, and any incomplete row within 24 hours of `deadline_at`.
5. Test with AppsFlyer’s stub API before production. Change the endpoint only in a controlled test build/function revision; never send test identifiers to production.

## Data Locker and retention

Capability and licensing are not exposed by the available AppsFlyer tools. If Data Locker is licensed:

- Use a dedicated private GCS bucket in the existing CountryBean project.
- Parquet, Fernly app segregation, no public access.
- AppsFlyer gets write-only access; operators get least-privilege read access.
- Raw install/session/event/uninstall retention: 400 days.
- Aggregate campaign/cost retention: 25 months.
- Configure automatic lifecycle deletion.

If unavailable, use documented AppsFlyer dashboard/manual exports. Do not replace a paid AppsFlyer capability with undeclared custom infrastructure.

## Dashboards and alerts

Create these AppsFlyer dashboards:

- Acquisition economics: spend, installs, CPI, gross revenue, D7/D30 ROAS.
- Funnel: install → onboarding → scan → plant → paywall → trial → paid.
- Partner quality: Apple/Meta/Google campaign, ad set, creative, keyword.
- Apple privacy: SKAN null-CV rate, direct/modeled mix, postback sequence.
- Data quality: organic share, unknown source, event volume, integration health.
- Revenue reconciliation: AppsFlyer gross versus RevenueCat gross; net proceeds exported separately.

Alert on:

- no production events after release;
- partner/cost data stale over 24 hours;
- two consecutive missing export deliveries;
- revenue mismatch over 5% after timing/currency normalization;
- schema column changes;
- sudden organic-share or null-CV movement.

## Release verification

Use `test_` campaign/event labels on a registered production test device. Verify organic install/session/event groups, identity, consent acceptance/rejection/withdrawal, direct and deferred OneLink, RevenueCat sandbox lifecycle events, APNs token registration, and OpenDSR queueing.

Run locally:

```powershell
npm.cmd run analytics:check
npm.cmd run test:focused
npm.cmd run typecheck
npx.cmd expo config --type public --json
```

Inspect the generated iOS project for plugin wiring, associated domains, postback endpoints, `FirebaseAnalyticsCollectionEnabled=false`, absence of `NSUserTrackingUsageDescription`, and absence of ATT/IDFA code.

An EAS device build uploads source/configuration to Expo and requires explicit user approval. TestFlight submission also requires explicit approval and IPA inspection.
