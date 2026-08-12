# Fernly provider and Jira evidence

Verified on 2026-08-11/12. This record intentionally excludes credentials,
token-bearing URLs, request bodies, browser state, user data, and screenshots.

## Credential isolation

- The Apps Script provider and Supabase share one Fernly-only provider HMAC.
- Supabase holds a separate Fernly-only ingress HMAC.
- Supabase holds the isolated Apps Script deployment URL.
- Jira has a generated Fernly-only webhook token; Supabase holds only the
  authenticated `URL/token` form.
- Every setup value that appeared in interactive UI diagnostics was immediately
  invalidated. The active proof credentials were generated afterward and were
  never printed or recorded.

## Direct provider proof

- Final post-rotation controlled label:
  `fernly-incident-5fa06a5f8372f3543c156de8`.
- A request with an invalid provider HMAC returned fixed status `unauthorized`.
- The valid request returned fixed status `sent`.
- Exact replay returned fixed status `duplicate`.
- `nalin.aditya@gmail.com`: exactly one matching controlled message verified.
- `starklabs2026@gmail.com`: exactly one matching Inbox message verified.
- The invalid-signature control label had zero matching messages in both
  inboxes.

The earlier pre-rotation controlled label
`fernly-incident-1682450279e8499443fa5201` also passed sent/replay/inbox checks.
It is retained only as historical controlled evidence; the final proof above
uses the same active provider HMAC as the backend and live canary.

This is both-inbox evidence; the provider HTTP result alone was not treated as
delivery proof.

## Production ingress rejection

- A fresh check after final credential rotation returned HTTP 403 with fixed
  code `unauthorized` for a wrong HMAC.
- A fresh check returned HTTP 403 with fixed code `wrong_app` for an invalid
  application identifier.
- Both checks were rejected before reservation or provider/Jira activity.

## Jira Automation proof

- Rule: `Fernly Production Incident Create Update`
- Project/Epic: `FERN` / `FERN-2`
- Rule state: `ENABLED`.
- Guards: `appId=fernly`, `environment=production`, and dedupe-label regex
  `^fernly-incident-[a-f0-9]{24}$`.
- Lookup: exact label in project `FERN`, issue type `Bug`.
- Controlled label: `fernly-incident-4d0221970832da73f78f864d`.
- Exactly one matching Bug exists: `FERN-3`, parent `FERN-2`.
- Create audit: success, ID
  `1163d1d8-fd8c-4d10-bae2-3d96d719604b`, log
  `FERNLY_JIRA_CREATE`.
- Exact replay kept the exact-label issue count at one and updated `FERN-3`.
- Update audit: success, ID
  `5cdac86d-d5da-4e46-b04c-14de740395f6`, log
  `FERNLY_JIRA_UPDATE`.
- A wrong-app request produced `No actions performed` in audit ID
  `1a2796e5-b43e-4fff-a0ab-ca4a466af917`.
- A wrong webhook token created no Automation audit entry.
- Controlled Bug `FERN-3` was transitioned to `Done` after proof capture.

The provider and Jira proof gate is complete. Active credentials remain only in
Apps Script, Supabase, and Jira control-plane storage.
