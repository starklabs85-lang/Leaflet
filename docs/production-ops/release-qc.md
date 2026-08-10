# Fernly release QC and ship decision

## Candidate identity

- Production repository: `https://github.com/starklabs85-lang/Leaflet.git`
- Baseline release branch/commit:
  `fernly_following_guidelines` / `afae9d5cf6eeb51eb8db47fd6bdc4c8edddd8373`
- Production-ops branch: `codex/fernly-production-ops`
- App version: `1.0.2`
- Bundle ID: `com.countrybean.leaflet`
- EAS project: `starklabs2026s-team/leaflet`
- Latest inspected App Store-profile build: `1.0.2 (36)`, build ID prefix
  `532ca5cd`, source commit `afae9d5c`
- Build 36 submission state: not shown as submitted

This rollout changes Supabase migrations, Edge Functions, provider code, and
operator documentation. It does not change the mobile application bundle.

## Engineering gate

Required before dormant deployment:

- [x] 80 focused application regressions pass when serialized.
- [x] Analytics generated-manifest check passes.
- [x] 40 production-ops/provider/config tests pass after the deployment-config
  guard was added (39 already passed at provider commit `a8e81ff6`).
- [x] 29 pgTAP reservation/replay/kill-switch/outbox checks pass locally.
- [x] Newly added production-ops Deno modules type-check.
- [x] The complete Edge check has no introduced error; it retains the same 24
  baseline Supabase generic-inference errors.
- [x] Linked migration list was re-run: only `20260811090000` is pending.
- [x] Linked pre-migration lint was re-run. It reports one ambiguity in the
  deployed legacy `reserve_fernly_paging_delivery` function; the pending
  hardening migration deliberately drops that function.
- [ ] Linked lint is re-run after dormant migration deployment to prove the
  legacy finding is removed and no new finding exists.
- [ ] Dormant production migration/function provenance is captured.
- [ ] Public health and unauthorized-ingress proofs pass.
- [ ] Provider, Jira, canary, replay, and kill-switch proofs pass.

The repository tracks an incomplete/non-executable dependency tree. The normal
`npm run typecheck` wrapper cannot execute its tracked `tsc` shim, and concurrent
TSX transforms have a baseline race. Neither issue was introduced by this
rollout. Tests are run with a clean TSX executable and serial concurrency where
needed; the defect remains a release-tooling follow-up.

## Product-path QC

The checked-in reporters are fire-and-forget and fixed-code only. A paging
failure must not alter these product responses:

- authentication and anonymous/permanent identity transition;
- plant identification/diagnosis and scan cache/event writes;
- weather snapshot and plant-loading advice;
- account deletion and AppsFlyer erasure queue handling;
- RevenueCat webhook authentication and subscription upsert;
- mobile client primary-action reporting.

Run controlled non-user-data smokes for each path after dormant deploy. Never
upload plant images or use a real profile merely to exercise paging.

## Ship/no-ship

- Dormant database and Edge deployment: **allowed after linked lint/migration
  review**, with `enabled=false` and `kill_switch=true`.
- Live paging: **NO-SHIP** until both-inbox, exact replay, Jira audit/dedupe,
  wrong-app/wrong-token, canary, and kill-switch proofs are all present.
- Mobile binary: **no new build required** for this backend-only change.
- iOS build/submission: **not authorized and not performed**.
- Crashlytics: explicit known gap; see `crashlytics-gap.md`.

If any live gate is missing, final status must be “paging blocked,” never “live.”
