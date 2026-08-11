# Fernly provider and Jira evidence

Verified on 2026-08-11. This record intentionally excludes credentials,
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

- Controlled label: `fernly-incident-1682450279e8499443fa5201`
- A request with an invalid provider HMAC returned fixed status `unauthorized`.
- The valid request returned fixed status `sent`.
- Exact replay returned fixed status `duplicate`.
- `nalin.aditya@gmail.com`: exactly one matching controlled message verified.
- `starklabs2026@gmail.com`: exactly one matching Inbox message verified. The
  sender account also has the expected Sent copy to the other approved inbox;
  it is not a duplicate Inbox delivery.

This is both-inbox evidence; the provider HTTP result alone was not treated as
delivery proof.

## Production ingress rejection

- Wrong HMAC token: HTTP 403 with fixed code `unauthorized`.
- Wrong `appId`: HTTP 403 with fixed code `wrong_app`.
- Both checks ran while `enabled=false` and `kill_switch=true`, before any
  reservation or provider/Jira activity.

## Jira state and blocker

- Rule: `Fernly Production Incident Create Update`
- Project/Epic: `FERN` / `FERN-2`
- Guards, exact-label lookup, standard create/update branches, and fixed audit
  logs are saved.
- The authenticated Jira webhook credential is stored in Supabase.
- Controlled label attempted while the rule remained disabled:
  `fernly-incident-e07949b02a7cfd30ed0119aa`.
- Exact-label Jira query returned zero issues, confirming no Jira action was
  claimed from those HTTP responses.
- Jira's rule activation toggle did not persist through automated semantic,
  keyboard, or direct-coordinate interaction. The rule is still `DISABLED`.

Jira create/update audit proof and one exact-label Bug remain pending. Paging is
therefore **blocked** and the provider/Jira milestone email has not been sent.
