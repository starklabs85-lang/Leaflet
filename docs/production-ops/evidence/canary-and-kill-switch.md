# Fernly production canary and kill-switch evidence

Verified on 2026-08-12. This record excludes credentials, token-bearing URLs,
request bodies, browser state, user data, and screenshots.

## Production provenance

- Supabase project: `gnrjqqoidzuwzvhhfggh` (`Leaflet`, production branch
  `main`).
- Local and remote migration ledgers match through `20260811090000`.
- Active deployments: `production-health` version 11,
  `production-incident` version 11, `identify-plant` version 18,
  `weather-tips` version 13, `delete-account` version 13, and
  `revenuecat-webhook` version 12.
- The final Fernly ingress, provider HMAC, provider URL, and Jira webhook URL
  are stored only as encrypted control-plane properties/secrets.

## Live canary

- Final controlled label: `fernly-incident-90af21b4d8c23e3e2f672bd9`.
- The authenticated ingress returned HTTP 202 with state `reserved`.
- Database delivery state: provider `delivered` with fixed code `accepted`;
  Jira `delivered`.
- `nalin.aditya@gmail.com`: exactly one matching Inbox message.
- `starklabs2026@gmail.com`: exactly one matching Inbox message.
- Exactly one matching Jira Bug exists: `FERN-5`, parent `FERN-2`.
- Create Automation audit: success, ID
  `a80f19cc-6ebd-4e81-9a79-dcf4df358674`, log
  `FERNLY_JIRA_CREATE`.

An earlier controlled canary correctly failed the gate when the provider and
backend HMACs did not match: Jira created controlled Bug `FERN-4`, provider
state was `rejected`, and neither inbox received that label. The provider HMAC
was rotated in both Apps Script and Supabase before the final canary above. No
exposed or mismatched credential remains active.

## Exact replay

- The exact same signed request returned HTTP 202 with state `duplicate`.
- Database occurrence count advanced to two; provider delivery count remained
  one and its state remained `delivered`.
- Both exact-label Inbox counts remained one.
- The exact-label Jira Bug count remained one (`FERN-5`).
- Update Automation audit: success, ID
  `7c9cf864-cc76-47ed-bef2-27c3749c3409`, log
  `FERNLY_JIRA_UPDATE`.
- Controlled Bugs `FERN-4` and `FERN-5` were transitioned to `Done` after
  evidence capture.

## Kill-switch drill

- Flags were set to `enabled=false`, `kill_switch=true` and verified from the
  returned production row.
- A fresh authenticated request for controlled label
  `fernly-incident-e9a8f0376ef380f63edbe844` returned HTTP 202 with state
  `disabled`.
- Both exact-label Inbox counts were zero.
- Exact-label Jira Bug count was zero.
- Jira Automation audit count remained 20 before and after the drill.
- Public database health remained HTTP 200 with the fixed schema-version-1
  response.

## Restored state

- Final flags were restored and verified as `enabled=true`,
  `kill_switch=false`.
- Final public health returned HTTP 200 and fixed status `ok`.
- A fresh wrong signature returned HTTP 403 / `unauthorized`.
- A fresh wrong app identifier returned HTTP 403 / `wrong_app`.

The live activation, exact-replay, and kill-switch gates are complete.
