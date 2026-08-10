import assert from "node:assert/strict";
import test from "node:test";

import { canonicalDigest, canonicalIncident, dedupeLabel } from "./canonical.ts";
import { parseIncidentRequest } from "./contract.ts";

const occurredAt = "2026-08-11T00:00:00.000Z";
const nonce = "0123456789abcdef0123456789abcdef";
const idempotencyKey = "abcdef0123456789abcdef0123456789";

const approvedPairs = {
  identify_failed: [
    "missing_openai_key",
    "openai_unavailable",
    "validation_failed",
    "scan_cache_unavailable",
    "scan_event_unavailable"
  ],
  account_delete_failed: [
    "erasure_queue_failed",
    "erasure_queue_release_failed",
    "storage_cleanup_failed",
    "delete_user_failed"
  ],
  revenuecat_webhook_failed: ["webhook_not_configured", "upsert_failed"],
  weather_tips_failed: ["weather_unavailable", "plants_unavailable"],
  client_primary_action_failed: ["function_error", "network_unavailable"],
  production_canary: ["controlled_test"]
} as const;

function request(category: string, code: string) {
  return {
    appId: "fernly",
    environment: "production",
    category,
    code,
    severity: "critical",
    occurredAt,
    nonce,
    idempotencyKey
  };
}

test("accepts every approved fixed category and code pair", () => {
  for (const [category, codes] of Object.entries(approvedPairs)) {
    for (const code of codes) {
      const parsed = parseIncidentRequest(request(category, code));

      assert.equal(parsed.ok, true, `${category}/${code} should be approved`);
      if (parsed.ok) {
        assert.deepEqual(parsed.value, request(category, code));
      }
    }
  }
});

test("rejects a code that belongs to a different category", () => {
  assert.deepEqual(
    parseIncidentRequest(request("identify_failed", "delete_user_failed")),
    { ok: false, code: "invalid_incident" }
  );
});

test("rejects an incident for another application before delivery", () => {
  assert.deepEqual(
    parseIncidentRequest({ ...request("production_canary", "controlled_test"), appId: "clara" }),
    { ok: false, code: "wrong_app" }
  );
});

test("rejects a non-production incident before delivery", () => {
  assert.deepEqual(
    parseIncidentRequest({
      ...request("production_canary", "controlled_test"),
      environment: "staging"
    }),
    { ok: false, code: "wrong_environment" }
  );
});

test("rejects fields that could carry user or plant content", () => {
  for (const forbiddenKey of [
    "userId",
    "email",
    "image",
    "location",
    "message",
    "error",
    "stack",
    "requestBody"
  ]) {
    const parsed = parseIncidentRequest({
      ...request("identify_failed", "openai_unavailable"),
      [forbiddenKey]: "forbidden"
    });

    assert.deepEqual(parsed, { ok: false, code: "invalid_incident" }, forbiddenKey);
  }
});

test("rejects malformed fixed fields instead of normalizing caller content", () => {
  const invalidValues = [
    { severity: "warning" },
    { occurredAt: "yesterday" },
    { occurredAt: "2026-08-11T00:00:00Z" },
    { nonce: "0123456789abcdef" },
    { nonce: "G123456789abcdef0123456789abcdef" },
    { idempotencyKey: "raw-user-id:123" },
    { idempotencyKey: "ABCDEF0123456789ABCDEF0123456789" }
  ];

  for (const invalid of invalidValues) {
    assert.deepEqual(
      parseIncidentRequest({
        ...request("identify_failed", "openai_unavailable"),
        ...invalid
      }),
      { ok: false, code: "invalid_incident" }
    );
  }
});

test("canonicalizes validated fields in a fixed order", () => {
  const parsed = parseIncidentRequest(request("identify_failed", "openai_unavailable"));
  assert.equal(parsed.ok, true);

  if (parsed.ok) {
    assert.equal(
      canonicalIncident(parsed.value),
      [
        "fernly",
        "production",
        "identify_failed",
        "openai_unavailable",
        "critical",
        occurredAt,
        nonce,
        idempotencyKey
      ].join("\n")
    );
  }
});

test("creates only a Fernly 24-hex incident label", async () => {
  const parsed = parseIncidentRequest(request("identify_failed", "openai_unavailable"));
  assert.equal(parsed.ok, true);

  if (parsed.ok) {
    const label = await dedupeLabel(canonicalIncident(parsed.value));
    assert.match(label, /^fernly-incident-[a-f0-9]{24}$/);
    assert.equal(label, "fernly-incident-978b5cc1343b38f9a7fb1a99");
  }
});

test("creates the full canonical digest used by replay state", async () => {
  const parsed = parseIncidentRequest(request("identify_failed", "openai_unavailable"));
  assert.equal(parsed.ok, true);

  if (parsed.ok) {
    assert.equal(
      await canonicalDigest(canonicalIncident(parsed.value)),
      "978b5cc1343b38f9a7fb1a991e30a6ffee4205511792009b55a8102261d0e3fb"
    );
  }
});
