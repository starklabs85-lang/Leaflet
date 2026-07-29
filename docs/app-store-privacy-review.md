# Fernly App Store Privacy Review

Status: implementation checklist; privacy/legal approval is required before a global release.

## No ATT or IDFA

- Do not add `NSUserTrackingUsageDescription`.
- Do not call App Tracking Transparency APIs.
- AppsFlyer disables the advertising identifier before initialization.
- Firebase is linked with `withoutAdIdSupport`.
- RevenueCat receives only the AppsFlyer UID; Fernly never calls `collectDeviceIdentifiers` and never sets IDFA.

## Data categories to review in App Store Connect

Declare the categories actually collected after the production dashboards and retention settings are approved:

- User ID: pseudonymous Supabase UUID used as Firebase/AppsFlyer CUID and RevenueCat app user ID.
- Device ID: AppsFlyer installation ID and consent-permitted IDFV.
- Product interaction: allowlisted in-app events and centralized screen views.
- Purchases: subscription status and gross revenue from RevenueCat, not the client.
- Advertising data: campaign attribution, media source, and SKAN/AdAttributionKit results where available.
- Diagnostics: only if enabled by an operational provider configuration.

Do not declare Fernly as tracking users across other companies’ apps with IDFA. Confirm whether consented AppsFlyer partner postbacks meet Apple’s current “tracking” definition with legal counsel before answering the tracking question.

## Controls and retention

- Usercentrics mobile CMP must be configured for `com.countrybean.leaflet`, global including EEA/UK, with TCF enabled.
- “Privacy choices” is available from Profile and withdrawal stops Firebase, AppsFlyer, partner sharing, and future RevenueCat attribution synchronization.
- No pre-consent event is buffered or replayed.
- Account deletion queues an AppsFlyer OpenDSR erasure before the Supabase user is deleted.
- If Data Locker is licensed, raw data retention is 400 days and aggregate campaign/cost retention is 25 months.

## Release gate

Privacy/legal must review the in-app policy, provider DPAs, Usercentrics service definitions, retention values, partner postbacks, App Store privacy answers, and the no-ATT/no-IDFA claim before release.
