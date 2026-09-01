# Fernly Scan Development Build Specification

## Goal

Create an iOS device development build that uses the exact build 30 icon and can exercise Fernly's production-backed scan flow without changing or deploying production code.

## Verified facts

- Build 30 is EAS build `80c97a35-3d08-4a2f-9abf-1b077ba061c0`, created July 29, 2026 from commit `7a93126be8b6e52bb9854d210e823cb71b9e8882`.
- `assets/icon.png` at build 30 and on the current release branch have the identical SHA-256 digest `84133ffc80b9c77023e1e72c0bd61120ec5be9a27120c175935454d9428ae702`.
- The deployed `identify-plant` Edge Function is active and accepts authenticated traffic.
- The configured QA account is Free; the live function correctly returns `premium_required`. Premium enforcement must not be bypassed.
- The EAS development environment lacks the Supabase, RevenueCat, and Google client configuration required by an iOS development build.

## Requirements

- Preserve the existing Premium requirement for identification and diagnosis.
- Use build 30's exact icon bytes; do not redraw or regenerate the logo.
- Make EAS build profiles select their environments explicitly.
- Fail an EAS build before native compilation when required client configuration or the iOS Firebase plist is absent.
- Never print configuration values or commit `.env`, Firebase plist files, test credentials, tokens, or private keys.
- Configure only the EAS `development` environment in this task.
- Build the `development-device` profile for physical-device testing.
- Do not deploy Supabase functions, submit an App Store build, or modify the current production submission.

## Acceptance criteria

- Build-environment regression tests fail before implementation and pass afterward.
- Focused app tests, production-ops tests, analytics validation, and TypeScript checking pass.
- The source asset hash still matches build 30.
- EAS development configuration contains all required variable names without exposing values.
- A signed iOS development-device build completes and a test-install link is available.
