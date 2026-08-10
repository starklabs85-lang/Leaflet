# Fernly Production Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver and prove Fernly's privacy-safe health, paging, Jira deduplication, kill switch, monitoring, and release-QC safety net.

**Architecture:** Reconcile the two deployed Supabase functions and migrations into source control, then harden them behind a transactional Postgres reservation contract. Edge Functions and product-path reporters emit only fixed operational codes; an isolated Apps Script provider and a guarded Jira Automation webhook deliver independently with replay-safe state.

**Tech Stack:** Expo/React Native, TypeScript, Supabase Edge Functions (Deno), Supabase Postgres, Google Apps Script, Jira Automation, UptimeRobot, Firebase, EAS.

## Global Constraints

- The validated app ID is exactly `fernly`; production environment is exactly `production`.
- Approved urgent recipients are exactly `nalin.aditya@gmail.com` and `starklabs2026@gmail.com`.
- Dedupe labels must match `^fernly-incident-[a-f0-9]{24}$`.
- Jira audit log messages are exactly `FERNLY_JIRA_CREATE` and `FERNLY_JIRA_UPDATE`.
- Pager and Jira payloads contain fixed operational codes only; no plant images, diagnosis/model output, locations, profiles, raw IDs, tokens, emails, request bodies, exception text, stack traces, or IP addresses.
- Reporting failures never alter identification, weather, auth, billing, deletion, or webhook responses.
- Fernly ingress, provider HMAC, replay/nonce, and Jira credentials are unique and server-side only.
- Every production deployment starts with `enabled=false` and `kill_switch=true`.
- Paging remains disabled until provider, Jira, replay, wrong-app/token, canary, and kill-switch gates are proven.
- No iOS build or submission is created without Nalin's approval of the exact candidate.

---

### Task 1: Reconcile production drift and lock the baseline

**Files:**
- Modify: `.gitignore`
- Create: `docs/production-ops/evidence/baseline.md`
- Create: `supabase/functions/production-health/index.ts`
- Create: `supabase/functions/production-incident/index.ts`
- Create: `supabase/migrations/20260731070233_fernly_production_paging.sql`
- Create: `supabase/migrations/20260731072824_enforce_fernly_paging_category_code_pairs.sql`

**Interfaces:**
- Consumes: deployed Supabase project `gnrjqqoidzuwzvhhfggh` and verified Git commit `afae9d5cf6eeb51eb8db47fd6bdc4c8edddd8373`.
- Produces: reviewable source snapshots and a redacted baseline record for all later tasks.

- [ ] **Step 1: Record the failing source-of-truth check**

Run:

```bash
test -f supabase/functions/production-health/index.ts
test -f supabase/functions/production-incident/index.ts
test -f supabase/migrations/20260731070233_fernly_production_paging.sql
test -f supabase/migrations/20260731072824_enforce_fernly_paging_category_code_pairs.sql
```

Expected: at least the first check fails because deployed artifacts are absent from Git.

- [ ] **Step 2: Fetch authoritative artifacts with the official CLI**

Run from the worktree:

```bash
supabase functions download production-health --project-ref gnrjqqoidzuwzvhhfggh --use-api
supabase functions download production-incident --project-ref gnrjqqoidzuwzvhhfggh --use-api
supabase migration fetch --linked
```

Expected: the two function directories and the two July 31 migration files appear locally without changing production.

- [ ] **Step 3: Inspect for prohibited data before staging**

Run:

```bash
rg -n "request\.body|stack|exception|user_id|email|image|location|token|ip_address" \
  supabase/functions/production-health \
  supabase/functions/production-incident \
  supabase/migrations/20260731070233_fernly_production_paging.sql \
  supabase/migrations/20260731072824_enforce_fernly_paging_category_code_pairs.sql
```

Expected: every match is either a validation/rejection site or is removed before the artifact is staged; no secret value is printed.

- [ ] **Step 4: Write the redacted baseline evidence**

Record only branch/commit, bundle/version, Supabase project reference, deployed function names/versions, migration versions, Jira project/Epic, EAS build identity, UptimeRobot monitor count, and Crashlytics gap. Do not record URLs containing webhook tokens or any secret values.

- [ ] **Step 5: Re-run source-of-truth checks**

Expected: all four `test -f` commands exit zero.

- [ ] **Step 6: Commit the reconciled baseline**

```bash
git add .gitignore docs/production-ops/evidence/baseline.md \
  supabase/functions/production-health \
  supabase/functions/production-incident \
  supabase/migrations/20260731070233_fernly_production_paging.sql \
  supabase/migrations/20260731072824_enforce_fernly_paging_category_code_pairs.sql
git commit -m "chore: reconcile Fernly production ops baseline"
```

---

### Task 2: Implement the fixed privacy-safe contract

**Files:**
- Create: `supabase/functions/_shared/production-ops/types.ts`
- Create: `supabase/functions/_shared/production-ops/contract.ts`
- Create: `supabase/functions/_shared/production-ops/canonical.ts`
- Create: `supabase/functions/_shared/production-ops/contract.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `parseIncidentRequest(value: unknown): IncidentInput`, `canonicalIncident(input: IncidentInput): string`, and `dedupeLabel(canonical: string): Promise<string>`.
- `IncidentInput` contains only `appId`, `environment`, `category`, `code`, `severity`, `occurredAt`, `nonce`, and `idempotencyKey`.

- [ ] **Step 1: Write failing contract tests**

Add literal table cases proving every approved category/code pair succeeds, every cross-pair fails, `appId !== "fernly"` fails, `environment !== "production"` fails, unknown keys fail, and forbidden free-text keys fail. Add this behavior test:

```ts
test('creates only a Fernly 24-hex incident label', async () => {
  const label = await dedupeLabel('fernly\nproduction\nidentify_failed\nopenai_unavailable');
  assert.match(label, /^fernly-incident-[a-f0-9]{24}$/);
});
```

The production mutation caught is a wrong app prefix, wrong digest alphabet/length, or acceptance of a payload field capable of carrying user content.

- [ ] **Step 2: Run the tests and verify RED**

```bash
node node_modules/tsx/dist/cli.mjs --test supabase/functions/_shared/production-ops/contract.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the minimal contract**

Define the category map as a readonly literal and construct a new object containing only validated fields. Canonicalization must join the validated fixed fields in a documented order and must never serialize the caller's original object.

- [ ] **Step 4: Verify GREEN and run the existing suite**

```bash
node node_modules/tsx/dist/cli.mjs --test supabase/functions/_shared/production-ops/contract.test.ts
npm run test:focused
npm run analytics:check
```

- [ ] **Step 5: Commit**

```bash
git add package.json supabase/functions/_shared/production-ops
git commit -m "test: define Fernly incident privacy contract"
```

---

### Task 3: Authenticate operations ingress and suppress replay

**Files:**
- Create: `supabase/functions/_shared/production-ops/auth.ts`
- Create: `supabase/functions/_shared/production-ops/auth.test.ts`
- Modify: `supabase/functions/production-incident/index.ts`

**Interfaces:**
- Consumes: `canonicalIncident` from Task 2.
- Produces: `verifyOperationsSignature(headers, canonical, now, secret): Promise<AuthResult>` with fixed results `authorized`, `unauthorized`, `expired`, or `malformed`.

- [ ] **Step 1: Write failing authentication tests**

Use a literal 32-byte test-only secret and Web Crypto to generate a known signature. Tests prove valid requests pass, wrong signatures fail, missing headers fail, timestamps outside a five-minute window fail, and malformed nonces fail. Do not assert against a mock crypto function.

- [ ] **Step 2: Verify RED**

```bash
node node_modules/tsx/dist/cli.mjs --test supabase/functions/_shared/production-ops/auth.test.ts
```

- [ ] **Step 3: Implement constant-time Web Crypto verification**

Require headers `x-fernly-timestamp`, `x-fernly-nonce`, and `x-fernly-signature`. Sign the exact UTF-8 string `${timestamp}.${nonce}.${canonical}` with HMAC-SHA-256. Reject before database access when any guard fails.

- [ ] **Step 4: Add an Edge Function boundary test**

Extract `handleProductionIncident(request, dependencies)` so a test can use real `Request`/`Response` objects and a fake reservation boundary. Assert wrong app and wrong signature return fixed 403 responses and the reservation dependency is not called.

- [ ] **Step 5: Verify GREEN**

```bash
node node_modules/tsx/dist/cli.mjs --test \
  supabase/functions/_shared/production-ops/auth.test.ts \
  supabase/functions/production-incident/index.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/production-ops/auth.ts \
  supabase/functions/_shared/production-ops/auth.test.ts \
  supabase/functions/production-incident
git commit -m "feat: authenticate Fernly incident ingress"
```

---

### Task 4: Harden transactional reservation, quotas, and the kill switch

**Files:**
- Create: `supabase/migrations/20260811090000_harden_fernly_production_paging.sql`
- Create: `supabase/tests/production_paging_test.sql`
- Create: `supabase/verification/verify-production-paging.sql`

**Interfaces:**
- Produces: `public.reserve_fernly_production_incident(...)`, `public.lease_fernly_production_delivery(...)`, `public.complete_fernly_production_delivery(...)`, and `public.fernly_production_health()`.
- Reservation returns fixed decision fields: `status`, `dedupe_label`, `occurrence_count`, `provider_delivery_key`, `send_provider`, and `send_jira`.

- [ ] **Step 1: Write failing pgTAP tests**

Cover these observable mutations: kill switch disabled accidentally permits a reservation; replay with the same nonce and different canonical digest is accepted; hourly limit eleven is allowed when the configured limit is ten; a completed provider key is leased twice; and a dedupe label has the wrong format.

- [ ] **Step 2: Run against a disposable local Supabase database and verify RED**

```bash
supabase start
supabase db reset --local
supabase test db supabase/tests/production_paging_test.sql
```

Expected: tests fail because the hardening RPCs and lease constraints do not exist.

- [ ] **Step 3: Implement a forward-only migration**

The migration must preserve existing rows, set the Fernly config to `enabled=false, kill_switch=true`, add unique app-scoped nonce/idempotency indexes, separate provider/Jira delivery states, use `FOR UPDATE` or equivalent transactional locking, revoke public table/RPC access, and grant execution only to `service_role` for internal RPCs. `fernly_production_health()` returns a boolean and reveals no rows or configuration.

- [ ] **Step 4: Verify GREEN and migration idempotence**

```bash
supabase db reset --local
supabase test db supabase/tests/production_paging_test.sql
supabase db lint --local --level warning
psql "$LOCAL_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/verification/verify-production-paging.sql
```

The local test URL is obtained from `supabase status -o env`; it is never committed.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260811090000_harden_fernly_production_paging.sql \
  supabase/tests/production_paging_test.sql \
  supabase/verification/verify-production-paging.sql
git commit -m "feat: harden Fernly paging reservations"
```

---

### Task 5: Deliver bounded provider and Jira requests

**Files:**
- Create: `supabase/functions/_shared/production-ops/delivery.ts`
- Create: `supabase/functions/_shared/production-ops/delivery.test.ts`
- Create: `supabase/functions/_shared/production-ops/payload.ts`
- Create: `supabase/functions/_shared/production-ops/payload.test.ts`
- Modify: `supabase/functions/production-incident/index.ts`

**Interfaces:**
- Produces: `buildProviderPayload(reservation)`, `buildJiraPayload(reservation)`, and `deliverWithTimeout(fetcher, request, timeoutMs)`.
- Provider/Jira payload types contain only fixed operational fields defined by the design.

- [ ] **Step 1: Write failing payload tests**

Assert exact literal objects for an `identify_failed/openai_unavailable` reservation. Include a recursive assertion that rejects keys or values matching forbidden content fields. Assert Jira log action is `FERNLY_JIRA_CREATE` for first occurrence and `FERNLY_JIRA_UPDATE` for replay.

- [ ] **Step 2: Write failing timeout and retry tests**

Use a real abort-aware fake fetcher. Prove the request aborts at the injected deadline, only retryable 5xx/timeout results receive bounded retries, 4xx results do not retry, and a provider failure does not prevent an independent Jira attempt.

- [ ] **Step 3: Verify RED**

```bash
node node_modules/tsx/dist/cli.mjs --test \
  supabase/functions/_shared/production-ops/payload.test.ts \
  supabase/functions/_shared/production-ops/delivery.test.ts
```

- [ ] **Step 4: Implement minimal delivery behavior**

Use `AbortSignal.timeout` or an injected timer, at most three attempts, and capped deterministic delays. Read provider/Jira URLs and HMAC secrets from server-only Deno environment variables. Never log URLs, headers, payloads, exceptions, or response bodies.

- [ ] **Step 5: Verify GREEN and all production-ops tests**

```bash
node node_modules/tsx/dist/cli.mjs --test $(find supabase/functions -name '*.test.ts' -print | sort)
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/production-ops supabase/functions/production-incident
git commit -m "feat: add bounded Fernly incident delivery"
```

---

### Task 6: Add privacy-safe health and trusted product-path reporters

**Files:**
- Create: `supabase/functions/_shared/production-ops/reporter.ts`
- Create: `supabase/functions/_shared/production-ops/reporter.test.ts`
- Modify: `supabase/functions/production-health/index.ts`
- Create: `supabase/functions/production-health/index.test.ts`
- Modify: `supabase/functions/identify-plant/index.ts`
- Modify: `supabase/functions/weather-tips/index.ts`
- Modify: `supabase/functions/delete-account/flow.ts`
- Modify: `supabase/functions/revenuecat-webhook/index.ts`

**Interfaces:**
- Produces: `reportOperationalFailure(client, category, code): Promise<void>` and `handleProductionHealth(dependencies): Promise<Response>`.
- Reporter has no parameters capable of carrying free text or user identifiers.

- [ ] **Step 1: Write failing reporter noninterference tests**

For each product function, extract or use its existing dependency boundary and force the reporter to reject. Assert the original success/error response is byte-for-byte unchanged. Name each test after the production break it prevents, such as `reporter outage cannot change identify-plant response`.

- [ ] **Step 2: Write failing health response tests**

Assert healthy response equals:

```json
{"appId":"fernly","environment":"production","status":"ok","schemaVersion":1}
```

Assert database failure returns a fixed 503 body without exception text, project reference, latency, table names, or flags.

- [ ] **Step 3: Verify RED**

```bash
node node_modules/tsx/dist/cli.mjs --test \
  supabase/functions/_shared/production-ops/reporter.test.ts \
  supabase/functions/production-health/index.test.ts
```

- [ ] **Step 4: Implement best-effort reporters**

Map only the approved failure branches to fixed pairs. Catch and discard reporting failures. Do not pass caught error objects to the reporter or log them from the reporter.

- [ ] **Step 5: Verify GREEN and product regression tests**

```bash
node node_modules/tsx/dist/cli.mjs --test $(find supabase/functions -name '*.test.ts' -print | sort)
npm run test:focused
npm run analytics:check
node node_modules/typescript/bin/tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/production-ops/reporter.ts \
  supabase/functions/_shared/production-ops/reporter.test.ts \
  supabase/functions/production-health \
  supabase/functions/identify-plant/index.ts \
  supabase/functions/weather-tips/index.ts \
  supabase/functions/delete-account/flow.ts \
  supabase/functions/revenuecat-webhook/index.ts
git commit -m "feat: report fixed Fernly operational failures"
```

---

### Task 7: Build the isolated Apps Script email provider

**Files:**
- Create: `ops/apps-script/fernly-production-alerts/Code.gs`
- Create: `ops/apps-script/fernly-production-alerts/appsscript.json`
- Create: `ops/apps-script/fernly-production-alerts/provider.test.ts`
- Create: `docs/production-ops/provider-runbook.md`

**Interfaces:**
- Consumes: signed fixed provider payload from Task 5.
- Produces: fixed JSON responses with `status` equal to `sent`, `duplicate`, `unauthorized`, or `malformed`.

- [ ] **Step 1: Write a failing Apps Script behavior harness**

Load `Code.gs` into a Node VM with real JSON/crypto logic and fakes for `PropertiesService`, `LockService`, `Utilities`, and `MailApp`. Prove a valid request sends exactly two messages to the approved addresses, the same delivery key sends zero additional messages, a wrong HMAC sends none, and any unrecognized payload field is rejected.

- [ ] **Step 2: Verify RED**

```bash
node node_modules/tsx/dist/cli.mjs --test ops/apps-script/fernly-production-alerts/provider.test.ts
```

- [ ] **Step 3: Implement the provider**

Use Script Properties `FERNLY_PROVIDER_HMAC_SECRET` and a Fernly-only replay namespace. Acquire a script lock before reading/writing replay state. Hardcode the approved recipient array and build subject/body from fixed fields only. Never call `console.log` or `Logger.log` with request data.

- [ ] **Step 4: Verify GREEN**

```bash
node node_modules/tsx/dist/cli.mjs --test ops/apps-script/fernly-production-alerts/provider.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add ops/apps-script/fernly-production-alerts docs/production-ops/provider-runbook.md
git commit -m "feat: add isolated Fernly alert provider"
```

---

### Task 8: Document Jira, monitoring, crash coverage, QC, and rollback

**Files:**
- Create: `docs/production-ops/jira-automation.md`
- Create: `docs/production-ops/uptimerobot.md`
- Create: `docs/production-ops/crashlytics-gap.md`
- Create: `docs/production-ops/release-qc.md`
- Create: `docs/production-ops/onboarding-analytics-design-qa.md`
- Create: `docs/production-ops/rollback.md`
- Create: `docs/production-ops/evidence/index.md`

**Interfaces:**
- Produces: exact operator steps and redacted proof locations used by Tasks 9 and 10.

- [ ] **Step 1: Write the Jira Automation runbook**

Specify guards, exact-label JQL, standard If/else, Bug creation, existing-issue comment/update, and exact audit log strings. Record the existing Epic `FERN-2`. Do not record the webhook URL or token.

- [ ] **Step 2: Write UptimeRobot and Crashlytics records**

Specify an HTTPS plus keyword monitor for the public health response. Record Crashlytics as blocked on SDK/native/device/dSYM proof and state that no build/submission is authorized.

- [ ] **Step 3: Write release-QC and product-quality artifacts**

Cover current app version/build, ship/no-ship gates, onboarding behavior, declared analytics contract, and a design QA checklist tied to the current app rather than a prototype.

- [ ] **Step 4: Write exact rollback and kill-switch commands**

Include the SQL in the approved design, function redeploy commands naming `production-health` and `production-incident`, and proof queries that return only flags/counts. No credential-bearing commands are stored.

- [ ] **Step 5: Commit**

```bash
git add docs/production-ops
git commit -m "docs: add Fernly production ops runbooks"
```

---

### Task 9: Deploy dormant and configure authoritative providers

**Files:**
- Modify: `docs/production-ops/evidence/index.md`
- Create: `docs/production-ops/evidence/dormant-deployment.md`
- Create: `docs/production-ops/evidence/provider-and-jira.md`

**Interfaces:**
- Consumes: reviewed commits from Tasks 1-8 and direct owner secret entry in authoritative UIs.
- Produces: a dormant production deployment with redacted provider and Jira proof.

- [ ] **Step 1: Run the full predeployment gate**

```bash
npm run test:focused
npm run analytics:check
node node_modules/tsx/dist/cli.mjs --test $(find supabase/functions ops -name '*.test.ts' -print | sort)
node node_modules/typescript/bin/tsc --noEmit
supabase db lint --linked --level warning
supabase migration list --linked
```

Expected: tests pass, lint has no new errors, and only the reviewed hardening migration is pending.

- [ ] **Step 2: Configure unique secrets without exposing values**

In the selected signed-in Chrome session, create a new Fernly Apps Script project, enter the provider HMAC in Script Properties, and deploy it. In Supabase secret management, enter the Fernly ingress/provider/Jira credentials directly. In Jira Automation, create the Fernly incoming-webhook rule. Never copy a secret into the terminal, chat, evidence, or clipboard history used for reports.

- [ ] **Step 3: Push the migration and functions dormant**

```bash
supabase db push --linked --include-all
supabase functions deploy production-health --project-ref gnrjqqoidzuwzvhhfggh
supabase functions deploy production-incident --project-ref gnrjqqoidzuwzvhhfggh
supabase functions deploy identify-plant --project-ref gnrjqqoidzuwzvhhfggh
supabase functions deploy weather-tips --project-ref gnrjqqoidzuwzvhhfggh
supabase functions deploy delete-account --project-ref gnrjqqoidzuwzvhhfggh
supabase functions deploy revenuecat-webhook --project-ref gnrjqqoidzuwzvhhfggh
```

Immediately verify `enabled=false` and `kill_switch=true` using the redacted config query from the rollback runbook.

- [ ] **Step 4: Prove health and authentication boundaries**

Record fixed public-health success, unauthenticated rejection, wrong-app rejection, and wrong-token rejection. Store status codes and fixed response bodies only.

- [ ] **Step 5: Prove provider delivery and replay**

Send one controlled signed provider request through the authoritative ingress. Verify one message in each approved inbox. Replay the exact signed request and verify both inbox counts remain one.

- [ ] **Step 6: Prove Jira create/update dedupe**

Send a controlled Jira event, then exact replay. Verify Automation audit contains one `FERNLY_JIRA_CREATE` and one `FERNLY_JIRA_UPDATE`, and exact-label search returns one Bug. Close or label the controlled artifact as test evidence.

- [ ] **Step 7: Create UptimeRobot monitor**

Create the Fernly health monitor in the Stark Labs team and record its public name, check type, interval, current status, and redacted endpoint path.

- [ ] **Step 8: Commit redacted evidence**

```bash
git add docs/production-ops/evidence
git commit -m "docs: record dormant Fernly deployment proofs"
```

---

### Task 10: Canary, replay, kill-switch drill, and final handoff

**Files:**
- Create: `docs/production-ops/evidence/live-canary.md`
- Create: `docs/production-ops/evidence/kill-switch-drill.md`
- Create: `docs/production-ops/final-report.md`
- Modify: `docs/production-ops/evidence/index.md`

**Interfaces:**
- Produces: final flags, proof counts, rollback record, pushed commit, and explicit build/submission status.

- [ ] **Step 1: Permit one canary while paging remains controlled**

Set `kill_switch=false`, enable the narrowly scoped controlled canary, and submit one `production_canary/controlled_test` event. Verify one email per inbox, one exact-label Jira Bug, and successful public health.

- [ ] **Step 2: Replay the exact canary**

Replay identical timestamp, nonce, idempotency key, and body. Verify email counts remain one and Jira exact-label issue count remains one; the audit may show the update branch but no new issue.

- [ ] **Step 3: Drill the kill switch**

Set `kill_switch=true`. Send one fixed authenticated test from the API path and, where applicable, the trusted reporter path. Verify the response is fixed `disabled`, public health stays healthy, and provider inbox, Jira issue, and Automation audit counts do not change.

- [ ] **Step 4: Restore final flags only if every gate passed**

Set `enabled=true`, `kill_switch=false` only when all provider/Jira/canary/replay/drill evidence is present. Otherwise leave `enabled=false`, `kill_switch=true` and state the exact blocker.

- [ ] **Step 5: Run final verification**

```bash
npm run test:focused
npm run analytics:check
node node_modules/tsx/dist/cli.mjs --test $(find supabase/functions ops -name '*.test.ts' -print | sort)
node node_modules/typescript/bin/tsc --noEmit
git diff --check
git status --short
```

- [ ] **Step 6: Write and commit the final report**

The report states exact branch/commit, tests/build evidence, Supabase provenance, health/auth proof, both-inbox/replay proof, Jira audit/dedupe proof, final flags, UptimeRobot and Crashlytics state, rollback commands, remaining blockers, artifact paths, and that no iOS build/submission was created.

```bash
git add docs/production-ops
git commit -m "docs: finalize Fernly production ops rollout"
```

- [ ] **Step 7: Push the verified branch**

```bash
git push -u origin codex/fernly-production-ops
```

Record the resulting full commit SHA in `final-report.md` and update the existing Gmail thread at each completed milestone.
