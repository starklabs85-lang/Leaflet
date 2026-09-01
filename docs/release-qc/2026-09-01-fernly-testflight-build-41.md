# Fernly TestFlight Build 41 QC — 2026-09-01

## Scope

This artifact records the production-signed TestFlight candidate requested for device scan testing. It does not authorize or perform an App Store review submission.

## Source provenance

- Branch: `codex/fernly-build30-icon-scan-fix`
- Pushed source head at archive time: `808b885bb53b8b6ffbe4e8d1cfad6ff32ea13e03`
- Application source commit: `d057454609877b3b9639fa72aa82ea82a4cf2d9f`
- EAS project: `@starklabs2026s-team/leaflet`
- Bundle identifier: `com.countrybean.leaflet`
- Version/build: `1.0.2 (41)`

The EAS upload used no-VCS packaging because this repository historically tracks its dependency tree. The source tree was clean and matched the pushed branch head before archiving. EAS therefore records a null Git hash; the exact manually verified commit is recorded above.

## Candidate content

- The camera pre-permission action uses the neutral `Continue` contract required by Apple.
- Candidate `assets/icon.png` SHA-256: `84133ffc80b9c77023e1e72c0bd61120ec5be9a27120c175935454d9428ae702`.
- That hash exactly matches the icon used by EAS build 30 (`80c97a35-3d08-4a2f-9abf-1b077ba061c0`), created on 2026-07-29.
- Production builds reject development-login credentials.
- The production Firebase plist is supplied as a secret EAS file variable and is not stored in Git or this report.

## Fresh verification before archive

- Focused application tests: 87 passed, 0 failed
- Production-ops tests: 42 passed, 0 failed
- Build-configuration tests: 5 passed, 0 failed
- Analytics manifest check: passed
- TypeScript `tsc --noEmit`: passed
- Git diff check: passed
- Source head matched pushed remote: passed
- Camera pre-permission regression: passed
- Build 30 icon byte-hash comparison: passed

## EAS build

- Build ID: `7944f7e2-6fac-480d-8c61-4c819fd0ed03`
- Profile: `production`
- Platform/distribution: iOS / App Store
- Version/build: `1.0.2 (41)`
- Status: finished successfully at 2026-09-01 14:01:35 UTC
- Signed IPA artifact: present

## TestFlight submission

- Submission ID: `268bc866-646a-4eb9-a81c-ab6e6939674b`
- App Store Connect app ID: `6775880316`
- Credential source: EAS secure credential service
- EAS submission state: finished successfully at 2026-09-01 15:04:21 UTC with no error
- Apple processing state: build 41 had not yet appeared in the authenticated TestFlight build list at the final check; Apple processing remains pending
- App Store review submission: not performed

The obsolete local App Store Connect key-file reference was removed from `eas.json`; submission now uses the already configured EAS server-side credential without copying a private key into the worktree.

## Device acceptance requirement

Build 41 must be tested through TestFlight with an active Premium sandbox entitlement. Verify camera permission wording, capture, upload, plant identification completion, and result rendering. A Free account is expected to show the paywall; that is not a scan failure.
