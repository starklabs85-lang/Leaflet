# Fernly TestFlight 1.0.3 (44)

## Release identity

- Marketing version: `1.0.3`
- iOS build number: `44`
- Bundle identifier: `com.countrybean.leaflet`
- Source branch: `codex/fernly-build30-icon-scan-fix`
- Source commit: `5c55364b63b92e1079a9642ca21a413f78119608`
- EAS build: `e1d7cc7d-1e8f-48fa-9b4c-fb58434a023f`
- EAS submission: `3a92b568-367b-46a2-9bdf-a59687512f18`

Build number 43 was consumed during an optional local fingerprint pass that was
cancelled before an EAS build record was created. The replacement upload uses
build 44.

## Verification

- Focused tests: 88 passed.
- Production-ops tests: 42 passed under Node 24.13.0.
- Build-environment tests: 5 passed.
- Analytics generated-output check: passed.
- TypeScript `--noEmit`: passed.
- EAS production build: finished.
- EAS submission transport: finished with no reported upload error.
- App Store Connect: `1.0.3 (44)` visible under TestFlight, internal status
  `in beta testing`, external status `ready for beta submission`.

The downloaded IPA was inspected directly:

- `CFBundleShortVersionString`: `1.0.3`
- `CFBundleVersion`: `44`
- `CFBundleIdentifier`: `com.countrybean.leaflet`
- IPA SHA-256: `f413ff6386941803a414ccf379e53c61c6052576f867446dd1bbd6b5a46c2c52`
- Embedded iPhone icon: 120 x 120 PNG, RGB, no alpha; visually matches the
  approved Fernly leaf-scan logo.
- Embedded iPad icon: 152 x 152 PNG, RGB, no alpha.

## Delivery

The verified TestFlight status, EAS build link, and App Store Connect TestFlight
link were emailed to `nalin.aditya@gmail.com` after Apple listed build 44.

This action created and distributed a TestFlight build only. It did not submit
version 1.0.3 for App Store review or production release.
