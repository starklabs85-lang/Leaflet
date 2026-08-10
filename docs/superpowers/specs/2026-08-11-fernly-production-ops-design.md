# Fernly Production Ops Design

**Status:** Approved by Nalin on 2026-08-11

**Accountable owner:** Arnab

## Outcome

Fernly receives a privacy-safe production safety net that can report fixed operational failures without leaking user or plant data, page the two approved inboxes, create or update one deduplicated Jira Bug, expose minimal public health, and be disabled immediately by a database kill switch. Production activation remains gated on direct provider, Jira Automation, replay, canary, and kill-switch evidence.

## Verified baseline

- Release source: `fernly_following_guidelines` at `afae9d5cf6eeb51eb8db47fd6bdc4c8edddd8373`.
- Rollout branch: `codex/fernly-production-ops` in an isolated worktree.
- App ID: `fernly`; bundle ID: `com.countrybean.leaflet`; app version: `1.0.2`.
- Supabase project: `gnrjqqoidzuwzvhhfggh`.
- Deployed but untracked functions: `production-health` and `production-incident`.
- Deployed but untracked migrations: `20260731070233_fernly_production_paging` and `20260731072824_enforce_fernly_paging_category_code_pairs`.
- Current production paging row is dormant but unsafe for rollout: `enabled=false`, `kill_switch=false`.
- Jira project: `FERN`; production-ops Epic: `FERN-2`; no Automation rule exists.
- Apps Script has no isolated Fernly provider.
- UptimeRobot Stark Labs team has no monitors.
- Firebase project `fernly-b36cd` has App and Analytics but no Crashlytics SDK/issue dashboard proof.
- EAS has a successful iOS `1.0.2 (36)` build from the verified commit. It is not the latest recorded submitted build, and this rollout does not authorize another build or submission.

## Chosen approach

Reconcile and harden the existing production artifacts. Download the deployed functions and migration history for comparison, write characterization and contract tests first, then place reviewed equivalents under source control. Preserve existing database state and introduce a forward-only corrective migration. Do not delete or recreate the production paging tables.

This is safer than either replacing the live implementation without comparison or rolling back the untracked deployment before a source-controlled replacement is proven.

## Architecture

### Public health

`production-health` is an unauthenticated Supabase Edge Function with a fixed response shape. It performs a bounded database health RPC and returns only `appId`, `environment`, `status`, and a schema version. It never returns project references, database errors, latency details, row counts, configuration flags, or provider state.

### Incident ingress and trusted reporters

`production-incident` supports two narrow caller classes:

1. A signed operations request using Fernly-only HMAC credentials, timestamp, nonce, and idempotency key. This path supports controlled tests and `production_canary`.
2. An authenticated Fernly mobile request for only the `client_primary_action_failed` category and its fixed codes. Supabase JWT authentication is required, but no user identifier is persisted or forwarded.

Critical Edge Functions call a shared best-effort reporter with service-role database access. The reporter accepts only a fixed category and code; it has no argument for exception text, user data, images, locations, request bodies, tokens, or identifiers. Reporting is bounded and swallowed so it cannot alter product responses.

### Database reservation and delivery state

A security-definer Postgres RPC validates `app_id=fernly`, the production environment, and an exact category/code pair. Under a transaction it:

- enforces the kill switch before any reservation;
- rejects reused nonces with a different canonical payload;
- reserves one app-scoped incident using a 24-hex dedupe digest;
- applies threshold, cooldown, and hourly quota policy;
- records provider and Jira delivery state separately;
- returns only the fixed fields needed to construct provider and Jira requests.

The dedupe label is always `fernly-incident-<24 lowercase hex>` and therefore matches `^fernly-incident-[a-f0-9]{24}$`.

Provider delivery is first-occurrence/cooldown controlled. Jira receives create-or-update events so an exact replay may update the existing issue while never creating a second issue. Delivery attempts use leases, bounded timeouts, and a finite retry count. A stale lease is recoverable; a completed provider delivery is never resent for the same delivery key.

### Email provider

Fernly gets a dedicated Google Apps Script project and deployment. Its HMAC and replay state are unique to Fernly and stored only in Script Properties. A script lock serializes replay checks. It sends a fixed subject and fixed operational-code body to exactly:

- `nalin.aditya@gmail.com`
- `starklabs2026@gmail.com`

The provider ignores all unrecognized fields, never logs the signed request, and returns only fixed success, duplicate, unauthorized, or malformed statuses.

### Jira Automation

The Fernly incoming-webhook rule uses a Fernly-only webhook URL/token and guards:

- `appId` equals `fernly`;
- `environment` equals `production`;
- `dedupeLabel` matches `^fernly-incident-[a-f0-9]{24}$`.

It performs an exact-label JQL lookup. A standard If/else branch creates one Bug when absent and comments/updates the existing Bug when present. Audit log messages are exactly `FERNLY_JIRA_CREATE` and `FERNLY_JIRA_UPDATE`. Jira fields contain fixed codes, timestamps, counts, and the dedupe label only.

### Monitoring and crash coverage

UptimeRobot receives one HTTPS monitor for `production-health`; a successful HTTP response is supplemented by a keyword check for the fixed healthy body. Crashlytics remains an explicit release gap until the SDK, native configuration, forced uncaught crash on a physical/device Release candidate, console issue, and dSYM/symbolication are proven. No iOS build or submission is created by this rollout without Nalin's approval of the exact candidate.

## Fixed category contract

The server accepts only these category/code pairs:

| Category | Codes |
| --- | --- |
| `identify_failed` | `missing_openai_key`, `openai_unavailable`, `validation_failed`, `scan_cache_unavailable`, `scan_event_unavailable` |
| `account_delete_failed` | `erasure_queue_failed`, `erasure_queue_release_failed`, `storage_cleanup_failed`, `delete_user_failed` |
| `revenuecat_webhook_failed` | `webhook_not_configured`, `upsert_failed` |
| `weather_tips_failed` | `weather_unavailable`, `plants_unavailable` |
| `client_primary_action_failed` | `function_error`, `network_unavailable` |
| `production_canary` | `controlled_test` |

New pairs require a migration, tests, and review. They cannot be supplied dynamically through environment variables or mobile input.

## Privacy and secret boundaries

- Operational payloads contain fixed app/environment/category/code/severity values, dedupe label, occurrence count, and coarse timestamps only.
- Plant images, identification or diagnosis output, weather location, profile data, raw IDs, email addresses, tokens, bodies, exception text, stack traces, and IP addresses are forbidden.
- Provider, Jira, ingress, nonce, and webhook credentials are unique to Fernly and remain only in Supabase secrets, Apps Script properties, or Jira's authoritative UI.
- Secrets are never placed in Expo/EAS public variables, app configuration, native plist files, Git, prompts, logs, reports, Jira comments, email bodies, or screenshots.

## Activation sequence

1. Commit source, tests, migrations, and runbooks.
2. Deploy the corrective migration and functions with `enabled=false`, `kill_switch=true`.
3. Prove public health and unauthorized/wrong-app rejection.
4. Prove the direct provider reaches both inboxes and exact replay sends no second email.
5. Prove Jira Automation create plus exact replay update with one exact-label Bug and both audit entries.
6. Set `kill_switch=false` while keeping `enabled=false`; run one controlled provider/Jira proof if required by the implementation.
7. Enable one `production_canary`; prove one email per inbox and one Jira Bug.
8. Replay the exact canary; counts remain one.
9. Set `kill_switch=true`; prove authenticated tests produce no provider, Jira, or Automation activity while public health remains good.
10. Restore final live flags only after every proof: `enabled=true`, `kill_switch=false`.

If any evidence is missing, paging remains dormant and the report states the exact blocker.

## Testing strategy

- Pure contract tests cover category pairs, canonicalization, app/environment validation, dedupe-label format, HMAC/timestamp/nonce handling, and privacy-safe payload construction.
- Database tests cover transactional reservation, replay conflict, exact replay, thresholds, cooldown, quota, delivery leases, and kill-switch behavior.
- Edge Function tests cover public health shape, unauthorized ingress, wrong app, mobile JWT scope, bounded dependency failures, and reporter noninterference.
- Provider tests use fake Apps Script services to prove signature verification, both-recipient delivery, and replay suppression without sending email.
- Controlled production proofs are recorded as redacted evidence; HTTP 2xx alone is not accepted as email proof, and Jira issue existence alone is not accepted as Automation proof.

## Rollback

The first rollback action is database-only and does not depend on a deploy:

```sql
update public.production_paging_config
set enabled = false, kill_switch = true, updated_at = now()
where app_id = 'fernly';
```

The function rollback redeploys the prior verified function version only after the database kill switch is confirmed. Forward migrations are not reversed destructively; a compensating migration is used if schema rollback is necessary.
