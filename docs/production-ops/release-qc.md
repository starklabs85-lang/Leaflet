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
- [x] 42 production-ops/provider/config tests pass, including the deployed
  public-health HEAD probe used by UptimeRobot.
- [x] 29 pgTAP reservation/replay/kill-switch/outbox checks pass locally.
- [x] Newly added production-ops Deno modules type-check.
- [x] The complete Edge check has no introduced error; it retains the same 24
  baseline Supabase generic-inference errors.
- [x] Linked migration list matches through `20260811090000` after dormant
  deployment.
- [x] Linked post-migration lint reports no schema errors or warnings.
- [x] Dormant production migration/function provenance is captured.
- [x] Public GET/HEAD health and unauthorized-ingress proofs pass.
- [x] Provider, Jira, canary, replay, and kill-switch proofs pass.

The repository tracks an incomplete/non-executable dependency tree. The normal
`npm run typecheck` wrapper cannot execute its tracked `tsc` shim, and concurrent
TSX transforms have a baseline race. Neither issue was introduced by this
rollout. Final verification used the compiler entry point directly and passed
with no diagnostics; the 80 focused regressions passed with a clean TSX
executable and serial concurrency. The wrapper defect remains a release-tooling
follow-up.

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
- Live paging: **SHIP / LIVE**. Both-inbox, exact replay, Jira audit/dedupe,
  wrong-app/wrong-token, canary, and kill-switch proofs are present. Final
  flags are `enabled=true`, `kill_switch=false`.
- Mobile binary: **no new build required** for this backend-only change.
- iOS build/submission: **not authorized and not performed**.
- Crashlytics: explicit known gap; see `crashlytics-gap.md`.

If a future verification loses any live gate, immediately restore dormant flags
and report paging as blocked until every proof is repeated.
