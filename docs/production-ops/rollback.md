# Fernly production-ops rollback and kill switch

All SQL below is Fernly-scoped and returns only flags or counts. Run it in the
linked Supabase SQL Editor or another approved authenticated database session.
Do not paste database URLs or credentials into commands, chat, logs, or tickets.

## Immediate stop / dormant state

```sql
update public.production_paging_config
set enabled = false,
    kill_switch = true,
    updated_at = now()
where app_id = 'fernly'
returning app_id, enabled, kill_switch;
```

Expected row: `fernly | false | true`. This is the first rollback action. It
prevents new reservation/outbox/provider/Jira work while public health remains
available.

## Dormant verification

```sql
select app_id, enabled, kill_switch, threshold_count, cooldown_seconds, hourly_limit
from public.production_paging_config
where app_id = 'fernly';

select
  count(*) as incident_count,
  count(*) filter (where provider_state in ('pending', 'leased')) as provider_open_count,
  count(*) filter (where jira_state in ('pending', 'leased')) as jira_open_count
from public.production_paging_incidents
where app_id = 'fernly';
```

The checked-in verifier is:

```text
supabase/verification/verify-production-paging.sql
```

## Live flags after every activation proof

Only after all provider, Jira, canary, replay, and kill-switch drill evidence is
complete:

```sql
update public.production_paging_config
set enabled = true,
    kill_switch = false,
    updated_at = now()
where app_id = 'fernly'
returning app_id, enabled, kill_switch;
```

Expected row: `fernly | true | false`.

## Function deployment and recovery

From the reviewed rollout worktree:

```bash
supabase functions deploy production-health --project-ref gnrjqqoidzuwzvhhfggh --no-verify-jwt --use-api
supabase functions deploy production-incident --project-ref gnrjqqoidzuwzvhhfggh --no-verify-jwt --use-api
supabase functions deploy identify-plant --project-ref gnrjqqoidzuwzvhhfggh --use-api
supabase functions deploy weather-tips --project-ref gnrjqqoidzuwzvhhfggh --use-api
supabase functions deploy delete-account --project-ref gnrjqqoidzuwzvhhfggh --use-api
supabase functions deploy revenuecat-webhook --project-ref gnrjqqoidzuwzvhhfggh --no-verify-jwt --use-api
```

If a deployment is unhealthy, enable the kill switch first, then redeploy the
last reviewed schema-compatible commit. Do not redeploy the recovered legacy
provider-only functions: the hardening migration intentionally replaces their
old RPCs. The hardening migration has no destructive down migration; retain the
new tables/columns and keep Fernly dormant.

## Credential isolation rollback

After the kill switch is confirmed, provider/Jira/ingress credentials can be
detached from the Edge environment without exposing their values:

```bash
supabase secrets unset FERNLY_PAGING_PROVIDER_URL FERNLY_PAGING_PROVIDER_HMAC_SECRET FERNLY_JIRA_WEBHOOK_URL FERNLY_PRODUCTION_INGRESS_HMAC_SECRET --project-ref gnrjqqoidzuwzvhhfggh
```

Restore only newly generated Fernly-only credentials through direct owner entry,
redeploy dormant, and repeat every activation proof. Never substitute a CryLens,
Cado, Clara, or Dishit credential.

## Kill-switch drill

1. Capture initial provider inbox counts, exact-label Jira issue count, and Jira
   Automation audit count.
2. Apply the immediate-stop SQL and prove `false/true` flags.
3. Send the fixed authenticated `production_canary/controlled_test` operation.
4. Prove the response state is `disabled` and provider/Jira/outbox counts do not
   change.
5. Prove public health remains HTTP 200 with `status=ok`.
6. Restore live flags only after every earlier gate remains valid.

Do not delete incidents, deliveries, Jira audit history, provider replay state,
or monitor history as part of rollback.
