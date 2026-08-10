# Fernly email provider runbook

## Contract

The Fernly provider is an isolated Google Apps Script web app. It accepts only a
strict JSON envelope containing `nonce`, `payload`, `signature`, and `timestamp`.
The HMAC binds the timestamp, provider delivery key, and canonical fixed-field
payload. The payload accepts only the checked-in Fernly category/code pairs and
the exact label form `^fernly-incident-[a-f0-9]{24}$`.

The provider sends one message to each approved urgent recipient:

- `nalin.aditya@gmail.com`
- `starklabs2026@gmail.com`

It never accepts plant content, model output, profiles, raw user identifiers,
tokens, request bodies, exception text, stack traces, IP addresses, or arbitrary
message text. Subject and body text are assembled only from validated operational
codes and fixed metadata.

## Authoritative setup

1. In the signed-in Stark Labs Apps Script account, create a standalone project
   named `Fernly Production Alert Email`.
2. Replace the project files with `Code.gs` and `appsscript.json` from
   `ops/apps-script/fernly-production-alerts/`.
3. In Project Settings, add the Script Property
   `FERNLY_PROVIDER_HMAC_SECRET`. The owner must enter a new Fernly-only secret
   directly in the field. Do not copy it into chat, Git, screenshots, logs,
   tickets, or email.
4. Deploy a new Web app version that executes as the owning Stark Labs account
   and permits anonymous HTTPS invocation. HMAC authentication is mandatory for
   every accepted request.
5. Enter the deployment URL directly as the Supabase secret
   `FERNLY_PAGING_PROVIDER_URL`, and enter the matching secret directly as
   `FERNLY_PAGING_PROVIDER_HMAC_SECRET`. Do not record either value in this
   repository.

Apps Script does not expose arbitrary incoming headers to `doPost`. Therefore,
the Edge Function sends the same HMAC metadata in the strict request envelope;
the provider independently reconstructs the canonical payload before checking
the signature. The non-secret headers are retained for intermediary inspection.
This follows Google's documented web-app event contract, which exposes POST data
through `e.postData.contents`: <https://developers.google.com/apps-script/guides/web>.

## Replay and retry behavior

The provider holds a script lock while checking and updating Fernly-only replay
state. Each recipient has a bit in the persisted delivery state. If one send
succeeds and the second fails, a backend retry sends only the missing recipient.
After both sends, the exact delivery key returns `{ "status": "duplicate" }`
and sends no additional mail. Replay entries older than seven days are pruned.

## Proof gate

Keep paging disabled and the server kill switch enabled while deploying. Before
activation, retain redacted evidence of all of the following:

1. A controlled signed request returns `sent`.
2. Exactly one matching message is visible in each approved inbox.
3. Replaying the exact request returns `duplicate` and inbox counts remain one.
4. A wrong signature returns `unauthorized` and sends nothing.
5. An extra payload field returns `malformed` and sends nothing.

An HTTP success response alone is not delivery proof.

## Rotation and rollback

To rotate, enable the database kill switch first, create a new Fernly-only HMAC
secret, update the Apps Script property and Supabase secret directly, then repeat
the full provider proof before restoring live flags. To stop provider traffic
immediately, keep paging disabled or the kill switch enabled in Supabase; do not
delete evidence or reuse another app's deployment or credentials.
