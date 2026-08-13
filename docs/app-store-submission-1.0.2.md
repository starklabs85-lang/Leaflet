# Fernly App Store Submission 1.0.2

Candidate: iOS version 1.0.2, remote build 39

Release: automatic after Apple approval

## Listing

- Name: Fernly - AI Plant Tracker
- Subtitle: AI Plant Care Tracker
- Primary category: Lifestyle
- Secondary category: Utilities
- Price: Free
- Age rating: 4+
- Legal owner: Aditi Somani
- Brand: Stark Labs
- Subscription attached to this version: Fernly Premium Monthly
  (`leaflet_premium_monthly`), USD 6.99, three-day trial
- Do not attach or reference an annual subscription.

Promotional text:

> Identify plants, diagnose issues, organize care, and keep your collection thriving with AI-powered guidance, reminders, and weather-aware tips.

What's New:

> Clearer privacy choices, including Apple's tracking permission
>
> Improved install attribution and OneLink deep-link handling
>
> Improved reliability across account and subscription flows
>
> General stability and performance improvements

## Review notes

Version 1.0.2 adds optional Firebase/AppsFlyer measurement and Apple App
Tracking Transparency.

No demo credentials are required. Fernly creates an anonymous session for core
use. Sign in with Apple or Google appears only when starting Premium.

On first launch, choose either measurement option. Fernly remains fully usable
if measurement or Apple tracking permission is declined. If measurement is
accepted, iOS may show ATT. IDFA and advertising-partner measurement are
enabled only when ATT is authorized.

To test Premium: Profile -> Upgrade to Premium -> Fernly Premium Monthly ->
Start 3-day free trial. Product ID: `leaflet_premium_monthly`. Restore purchases
is in Profile. Account deletion is Profile -> Delete account.

Camera/photo access is optional. Fernly uses Apple's Standard EULA.

## Submission gates

- App Store Connect authenticated and every missing-field warning resolved.
- Public Privacy Policy and Terms match the August 13, 2026 in-app legal copy.
- App Privacy saved with the broad ATT/attribution disclosure in
  `docs/app-store-privacy-review.md`.
- Archive is `com.countrybean.leaflet`, version 1.0.2, build 39.
- Physical iPhone tests cover first-party decline, ATT deny, ATT authorize,
  consent withdrawal, OneLink, monthly purchase/restore, and account deletion.
- Build 39 completes TestFlight processing without compliance warnings.
- Build 38 remains TestFlight-only and is never selected for App Review.
