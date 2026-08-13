# Fernly App Store Privacy Review

Status: owner-approved broad disclosure for version 1.0.2; App Store Connect
answers and public legal pages must match this document before review.

## ATT and identifier access

- Show Fernly's first-party measurement choice before initializing Firebase or
  AppsFlyer.
- Request App Tracking Transparency only after the user accepts that choice.
- Enable IDFA, AppsFlyer CUID, partner sharing, RevenueCat attribution sync,
  and uninstall-token registration only while ATT is authorized.
- When ATT is denied or unavailable, disable IDFA and user-level AppsFlyer
  identity, anonymize AppsFlyer, block all partner sharing, clear RevenueCat's
  AppsFlyer ID, and skip uninstall-token registration.
- Firebase is linked with `withoutAdIdSupport`.
- Core app access never depends on either consent choice.

## Data categories to review in App Store Connect

Declare these categories for version 1.0.2:

- Data used to track: Purchases, Device ID, Product Interaction, and Advertising
  Data. Purposes are Analytics and Developer's Advertising or Marketing.
- Linked but not used to track: Name, Email Address, User ID, Photos or Videos,
  Other User Content, and Coarse Location.
- Diagnostics: not linked to identity and not used to track.
- Tracking is conditional on Fernly measurement consent and ATT authorization;
  the broad label still covers the most permissive runtime path.

Answer Yes to tracking and Yes to use of the advertising identifier for
attributing installs and in-app conversions to previously served ads. Fernly
does not display third-party advertising.

## Controls and retention

- Fernly presents one first-party optional measurement choice globally and
  stores the decision, policy version, and decision time on the installation.
- The August 13, 2026 policy revision invalidates the earlier no-ATT consent so
  existing users must choose again.
- Fernly sends AppsFlyer manual DMA/GDPR consent fields and does not claim or
  generate an IAB TCF string.
- “Privacy choices” is available from Profile and withdrawal stops Firebase,
  AppsFlyer, partner sharing, future RevenueCat attribution synchronization,
  and uninstall measurement. Apple tracking permission remains managed in iOS
  Settings.
- No pre-consent event is buffered or replayed.
- Account deletion queues an AppsFlyer OpenDSR erasure before the Supabase user is deleted.
- If Data Locker is licensed, raw data retention is 400 days and aggregate campaign/cost retention is 25 months.

## Release gate

Before App Review, verify first-party decline, ATT denial, ATT authorization,
withdrawal, and re-consent on a physical iPhone. Confirm the public policy and
terms match the in-app copy, the App Store privacy answers above are saved, and
the selected archive contains the exact tracking usage description. If Fernly
later serves publisher advertising such as AdMob, reassess whether a certified
CMP is required before enabling it.
