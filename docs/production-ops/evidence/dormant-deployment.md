# Fernly dormant production deployment

Verified on 2026-08-11. This record intentionally excludes credentials,
token-bearing URLs, request bodies, user data, plant content, and screenshots.

## Reviewed source and database

- Branch: `codex/fernly-production-ops`
- Deployed source commit through public-health version 3: `73ab525e`
- Supabase project: `gnrjqqoidzuwzvhhfggh`
- Migration ledger matches through `20260811090000` locally and remotely.
- The hardening migration was applied by the official linked Supabase CLI.
- Linked post-migration schema lint reports no errors or warnings.
- The production `fernly` configuration row was verified in the authenticated
  Table Editor as `enabled=false` and `kill_switch=true`.

## Deployed Edge Functions

- `production-health`: active version 3, Supabase JWT enforcement disabled so
  public monitoring can call the fixed health contract.
- `production-incident`: active version 3, Supabase JWT enforcement disabled;
  the endpoint instead requires Fernly HMAC/timestamp/nonce authentication.
- Trusted reporter deployments: `identify-plant` version 10, `weather-tips`
  version 5, `delete-account` version 5, and `revenuecat-webhook` version 4.

All paging/provider/Jira work remains disabled by the database flags regardless
of the deployed code.

## Health and ingress proof

- Public GET health returned HTTP 200 with only the fixed `fernly`,
  `production`, `ok`, schema-version-1 contract.
- Public HEAD health returned HTTP 200 with an empty body for UptimeRobot.
- An incident request without authentication returned HTTP 401 with the fixed
  `auth_required` code.
- Unit regression coverage separately proves that wrong-app and wrong-signature
  requests are rejected before database reservation. Signed production proofs
  remain part of the provider/Jira gate after direct owner credential entry.

## External control-plane state

- The isolated Apps Script project is deployed as version 1, but its Fernly-only
  HMAC property and corresponding Supabase secrets remain pending direct owner
  entry.
- Jira Automation rule `Fernly Production Incident Create Update` is saved in
  project `FERN`, linked to Epic `FERN-2`, and remains disabled pending the
  controlled Jira proof.
- UptimeRobot monitor `Fernly production health` is configured on a five-minute
  interval. Its first HEAD probe exposed a 405 compatibility gap; health version
  3 now returns 200 to HEAD and the monitor recovered to `Up` on its next check.

## Gate result

The dormant-deployment gate is complete. Live paging remains **blocked** until
both-inbox delivery/replay, Jira Automation audit/dedupe, signed wrong-app and
wrong-token rejection, live canary/replay, kill-switch drill, and restored final
flags are all proven.
