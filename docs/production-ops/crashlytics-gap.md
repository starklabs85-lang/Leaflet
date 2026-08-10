# Fernly Crashlytics coverage gap

## Verified state

The current release repository and Firebase console do not provide native
uncaught-crash coverage proof:

- Firebase project: `fernly-b36cd`.
- Firebase App and Analytics exist.
- The Crashlytics console is still on the `Add SDK` onboarding state.
- `@react-native-firebase/crashlytics` is absent from `package.json`.
- No Crashlytics Expo config plugin is present in `app.config.ts`.
- This repository has no checked-in `ios/` directory, so there is no native
  Crashlytics run script or dSYM upload phase to inspect.
- There is no physical-device forced-crash, console-event, or dSYM-symbolication
  evidence for build `1.0.2 (36)`.

The production-ops rollout covers fixed server and Edge Function failures. It
does not turn unhandled React Native, Objective-C, or Swift crashes into pages.

## Exact closure requirement

Closing this gap requires a separate, approved native release candidate:

1. Add and configure the official React Native Firebase Crashlytics package.
2. Generate and review the native iOS project and Crashlytics/dSYM build phases.
3. Produce a new EAS iOS build for the exact reviewed commit.
4. Install that candidate on a physical device and trigger one controlled
   uncaught crash.
5. Prove the crash in the Fernly Firebase console and prove symbolicated frames
   and the matching dSYM/build identity.
6. Decide separately whether Crashlytics events feed the privacy-safe paging
   contract; raw exception text and stack traces must never enter email or Jira.

Nalin has not approved creating or submitting that candidate. Therefore:

- New iOS build required for this backend-only rollout: **no**.
- New iOS build required to close Crashlytics coverage: **yes**.
- iOS build created by this task: **no**.
- App Store submission made by this task: **no**.
- Crashlytics state: **known gap / blocked on explicit candidate approval and
  device proof**.
