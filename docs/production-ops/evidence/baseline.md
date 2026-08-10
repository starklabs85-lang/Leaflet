# Fernly Production Ops Baseline

Verified on 2026-08-10/11 before rollout implementation. This record intentionally excludes credential values, token-bearing URLs, request payloads, user data, and screenshots.

## Ownership and source

- Accountable owner: Arnab
- Jira project/Epic: `FERN` / `FERN-2`
- Verified release branch: `fernly_following_guidelines`
- Verified release commit: `afae9d5cf6eeb51eb8db47fd6bdc4c8edddd8373`
- Rollout branch: `codex/fernly-production-ops`
- Git origin: `https://github.com/starklabs85-lang/Leaflet.git`
- Bundle ID: `com.countrybean.leaflet`
- App version: `1.0.2`

## Application baseline

- Architecture: Expo/React Native client with Supabase Edge Functions and Supabase Postgres.
- Existing critical functions: `identify-plant`, `weather-tips`, `delete-account`, `process-appsflyer-erasure`, and `revenuecat-webhook`.
- Focused regression suite: 80 passed, 0 failed.
- Analytics manifest check: passed.
- `npm run typecheck` baseline wrapper: did not start TypeScript because the repository tracks `node_modules/.bin/tsc` as non-executable mode `100644`. Direct compiler invocation was separately attempted but blocked on the repository's large packed/tracked dependency tree. This is a baseline tooling defect, not a TypeScript diagnostic.

## Supabase provenance and drift

- Organization/project: Stark Labs / `gnrjqqoidzuwzvhhfggh`.
- Deployed functions include `production-health` and `production-incident` although neither existed in the verified Git commit.
- Remote-only migration versions before reconciliation:
  - `20260731070233_fernly_production_paging`
  - `20260731072824_enforce_fernly_paging_category_code_pairs`
- Official Supabase CLI downloads recovered both functions, their two shared modules, and both migration files into the rollout worktree.
- Production config observed before rollout: `enabled=false`, `kill_switch=false`, `cooldown_seconds=900`, `hourly_limit=10`.

## Recovered implementation gaps

- Provider-only delivery; no Jira delivery or independent delivery state.
- No Fernly operations HMAC/timestamp/nonce ingress or production canary pair.
- Mobile idempotency key is caller-supplied and can encode uncontrolled text.
- A principal-derived hash is persisted even though incident delivery does not need user linkage.
- Public health reveals paging/provider readiness rather than only API/database health.
- Initial migration explicitly defaults and inserts `kill_switch=false`.
- No checked-in isolated Apps Script provider or replay proof.
- No Jira Automation rule or audit proof.

## External production state

- EAS project: `leaflet` on `starklabs2026s-team`.
- Successful App Store profile build: iOS `1.0.2 (36)`, build ID prefix `532ca5cd`, source commit `afae9d5c`.
- Latest recorded successful Expo submission observed separately: iOS `1.0.2 (30)` from commit `7a93126`; build 36 was not shown as submitted.
- No new iOS build or submission is authorized by this rollout.
- Firebase project: `fernly-b36cd`; App and Analytics exist.
- Crashlytics state: SDK onboarding screen (`Add SDK`), with no forced-crash/device/console/dSYM proof.
- UptimeRobot team: Stark Labs; monitor count before rollout: 0.
- Apps Script account inspected: `starklabs2026@gmail.com`; no Fernly production alert project existed.
- Jira account inspected: `starklabs2026@gmail.com`; no Fernly Automation flow existed.
- Gmail rollout thread account: `nalin.aditya@gmail.com`.

## Secret hygiene finding

A tracked file named `supabase/.revenuecat-webhook-secret.local` existed at the verified commit. Its contents were not read or printed. The rollout removes the current tracked copy and ignores that exact path. Because removal does not erase earlier Git objects, the associated credential must be rotated and repository-history remediation must be handled as a separate, explicitly approved operation.

## Dormant gate

The baseline is **not** at the dormant-deployment gate because the kill switch is off and the recovered production artifacts are not yet reviewed, tested, committed, and redeployed from source control.

Immediately before the dormant gate, linked migration provenance showed only
`20260811090000` pending. Linked lint reported one ambiguity in the deployed
legacy `reserve_fernly_paging_delivery` function. The reviewed hardening
migration drops that legacy function; linked lint must be repeated after the
dormant migration is applied.
