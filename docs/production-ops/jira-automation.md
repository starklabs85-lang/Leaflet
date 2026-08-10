# Fernly Jira Automation runbook

## Authority and ownership

- Jira project: `FERN`
- Production-ops Epic: `FERN-2`
- Accountable rollout owner: Arnab
- Valid app/environment: `fernly` / `production`
- Required issue type: `Bug`
- Required dedupe label: `^fernly-incident-[a-f0-9]{24}$`

Create one Jira Automation rule named `Fernly Production Incident Create
Update`. Its incoming-webhook URL is a Fernly-only credential. Enter it directly
as the Supabase secret `FERNLY_JIRA_WEBHOOK_URL`; never put the URL in Git, chat,
screenshots, email, comments, or another app.

## Rule structure

1. Add the **Incoming webhook** trigger. Do not let the webhook select arbitrary
   issues from caller input.
2. Add these guards before any lookup or issue action:
   - `{{webhookData.appId}}` equals `fernly`.
   - `{{webhookData.environment}}` equals `production`.
   - `{{webhookData.dedupeLabel}}` matches
     `^fernly-incident-[a-f0-9]{24}$`.
3. Add **Lookup issues** with this exact-label JQL:

   ```text
   project = FERN AND issuetype = Bug AND labels = "{{webhookData.dedupeLabel}}" ORDER BY created ASC
   ```

4. Add a standard **If/else block**.

### If: no exact-label issue exists

Condition: `{{lookupIssues.size}}` equals `0`.

Create one issue with:

- Project: `FERN`
- Issue type: `Bug`
- Parent/Epic: `FERN-2` when the project exposes the Parent field
- Summary: `[FERNLY][CRITICAL] {{webhookData.category}}/{{webhookData.code}}`
- Label: `{{webhookData.dedupeLabel}}`
- Description containing only these fixed operational fields:

  ```text
  Fernly production incident
  appId={{webhookData.appId}}
  environment={{webhookData.environment}}
  severity={{webhookData.severity}}
  category={{webhookData.category}}
  code={{webhookData.code}}
  occurrenceCount={{webhookData.occurrenceCount}}
  occurredAt={{webhookData.occurredAt}}
  dedupeLabel={{webhookData.dedupeLabel}}
  ```

The create branch must include a **Log action** whose entire message is:

```text
FERNLY_JIRA_CREATE
```

### Else: exactly one issue exists

First require `{{lookupIssues.size}}` equals `1`. If it is greater than one,
stop the rule and investigate; do not create or fan out updates.

Use a related-issues JQL branch with the same exact-label JQL above and add this
fixed comment:

```text
Fernly production incident occurrence
appId={{webhookData.appId}}
environment={{webhookData.environment}}
severity={{webhookData.severity}}
category={{webhookData.category}}
code={{webhookData.code}}
occurrenceCount={{webhookData.occurrenceCount}}
occurredAt={{webhookData.occurredAt}}
dedupeLabel={{webhookData.dedupeLabel}}
```

The update branch must include a **Log action** whose entire message is:

```text
FERNLY_JIRA_UPDATE
```

Do not put provider URLs, Jira webhook URLs, tokens, email addresses, user data,
plant content, model output, request bodies, exception text, stack traces, or IP
addresses in fields, comments, or audit logs.

## Proof gate

Keep paging disabled and the kill switch enabled while testing. Retain redacted
evidence of:

1. One controlled request producing an Automation audit entry with
   `FERNLY_JIRA_CREATE` and one exact-label Bug.
2. Exact replay producing `FERNLY_JIRA_UPDATE` on the same issue, with the
   exact-label issue count remaining one.
3. A wrong-app request being rejected before Jira invocation.
4. A request to a wrong webhook credential producing no Fernly rule action.
5. The controlled Bug being closed or clearly marked as a controlled artifact
   after proofs are complete.

Issue existence alone is not Automation audit proof.
