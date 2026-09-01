# Fernly TestFlight Build 42 QC — 2026-09-02

## Scope

This artifact records the replacement production-signed TestFlight candidate containing the user-approved Fernly leaf-scan logo. It does not authorize or perform an App Store review submission.

## Source provenance

- Branch: `codex/fernly-build30-icon-scan-fix`
- Pushed source head at archive time: `f646aedf`
- EAS project: `@starklabs2026s-team/leaflet`
- Bundle identifier: `com.countrybean.leaflet`
- Version/build: `1.0.2 (42)`

The EAS upload used no-VCS packaging because this repository historically tracks its dependency tree. The source tree was clean and matched the pushed branch head before archiving. EAS therefore records a null Git hash; the exact manually verified commit is recorded above.

## Approved logo proof

- Input: user-supplied square Fernly leaf-scan JPEG
- Release asset: `assets/icon.png`
- Release asset SHA-256: `077be97c76a65f04bccca83084d2233c2c1aac509eaf8a8418e670854f0212f6`
- Release asset format: 1024 × 1024 RGB PNG with no alpha channel
- Signed IPA iPhone icon: 120 × 120 RGB PNG with no alpha channel
- Signed IPA iPad icon: 152 × 152 RGB PNG with no alpha channel
- Signed IPA visual inspection: leaf-scan logo present

The source image was resized and converted deterministically. No generative redesign was applied.

## Regression and build verification

- Focused application tests: 88 passed, 0 failed
- Production-ops tests: 42 passed, 0 failed
- Build-configuration tests: 5 passed, 0 failed
- Analytics manifest check: passed
- TypeScript `tsc --noEmit`: passed
- Camera pre-permission CTA regression: passed (`Continue` contract)
- Approved-logo regression: observed failing on the previous icon, then passing after replacement

## Build 41 failure boundary

- EAS build 41 finished successfully.
- EAS transporter submission 41 finished successfully with no recorded error.
- Apple did not expose build 41 in the authenticated TestFlight build list after processing.
- Therefore the observed failure occurred after transport, during Apple post-upload processing; it was not an EAS archive-upload or credential failure.
- The previous logo was byte-identical to accepted TestFlight build 30, so it was not evidence for build 41's processing failure.

## EAS build 42

- Build ID: `e8f195fd-692d-4190-b653-a11dd8af6a9c`
- Profile: `production`
- Platform/distribution: iOS / App Store
- Version/build: `1.0.2 (42)`
- Status: finished successfully at 2026-09-01 18:42:52 UTC
- Signed IPA artifact: present and inspected

## TestFlight submission

- Submission ID: `340aaa90-fd0a-41a1-8a8d-6db417d9cdd8`
- App Store Connect app ID: `6775880316`
- Credential source: EAS secure credential service
- EAS submission state: finished successfully at 2026-09-01 18:57:05 UTC with no recorded error
- Apple processing state: build 42 had not appeared in the authenticated TestFlight build list after approximately one hour; Apple processing details require a signed-in App Store Connect session or the processing-failure email
- App Store review submission: not performed

## Device acceptance requirement

Once Apple marks build 42 valid, install it through TestFlight using an active Premium sandbox entitlement. Verify the new home-screen icon, camera permission wording, capture, upload, plant identification completion, and result rendering. A Free account is expected to show the paywall; that is not a scan failure.
