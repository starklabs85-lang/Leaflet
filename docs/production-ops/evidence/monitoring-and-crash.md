# Fernly monitoring and crash coverage

Verified on 2026-08-11. This record excludes credentials, token-bearing URLs,
cookies, screenshots, user data, and unrelated account state.

## UptimeRobot

- Team: Stark Labs
- Monitor: `Fernly production health`
- Monitor type: HTTP/S, five-minute interval, default HEAD request
- Alert contact: `starklabs2026@gmail.com`
- Current status after health version 3 deployment: `Up`
- Successful post-fix check: verified in the signed-in monitor detail page
- Initial incident: HTTP 405, resolved after 5 minutes 6 seconds

The initial incident was caused by the free-plan monitor's HEAD request. The
privacy-safe health handler now checks database health for both GET and HEAD;
HEAD returns no response body. Direct GET and HEAD probes both return HTTP 200.

## Firebase Crashlytics inventory

- Firebase project: `fernly-b36cd`
- Firebase App and Analytics exist.
- Crashlytics console state: SDK onboarding (`Add SDK`).
- Repository state: no Crashlytics package, Expo config plugin, checked-in iOS
  native project, forced-crash device proof, console event proof, or dSYM proof.

This is an exact native uncaught-crash coverage gap, not verified Crashlytics
coverage. Closing it requires adding the native SDK/configuration and producing
a newly approved native candidate with device crash and dSYM evidence.

## Build state

The production-ops rollout is backend-only and requires no new mobile binary.
No iOS build or submission was created. A new iOS build remains explicitly
unauthorized unless Nalin approves the exact release candidate.
