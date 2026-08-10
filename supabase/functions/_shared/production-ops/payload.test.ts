import assert from "node:assert/strict";
import test from "node:test";

import { buildJiraPayload, buildProviderPayload } from "./payload.ts";
import { deliveryInput, reservation } from "./test-fixtures.ts";

function assertNoForbiddenContent(value: unknown) {
  const serialized = JSON.stringify(value).toLowerCase();
  for (const forbidden of [
    "userid",
    "email",
    "image",
    "plant",
    "location",
    "message",
    "error",
    "stack",
    "token",
    "requestbody",
    "ipaddress",
    "1f00d4bd-82fa-4f88-a1ff-cbd0935b92ef",
    "0123456789abcdef0123456789abcdef",
    "abcdef0123456789abcdef0123456789"
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
}

test("provider payload contains only fixed operational fields", () => {
  const payload = buildProviderPayload(deliveryInput, reservation);

  assert.deepEqual(payload, {
    appId: "fernly",
    environment: "production",
    category: "production_canary",
    code: "controlled_test",
    severity: "critical",
    dedupeLabel: "fernly-incident-eabf86951d6109555dcd82ab",
    occurrenceCount: 1,
    deliveryKey: "fernly-incident-eabf86951d6109555dcd82ab",
    occurredAt: "2026-08-11T00:00:00.000Z"
  });
  assertNoForbiddenContent(payload);
});

test("Jira payload selects the fixed create or update audit action", () => {
  assert.deepEqual(buildJiraPayload(deliveryInput, reservation), {
    appId: "fernly",
    environment: "production",
    category: "production_canary",
    code: "controlled_test",
    severity: "critical",
    dedupeLabel: "fernly-incident-eabf86951d6109555dcd82ab",
    occurrenceCount: 1,
    deliveryKey: "fernly-incident-eabf86951d6109555dcd82ab-00000001",
    occurredAt: "2026-08-11T00:00:00.000Z",
    auditAction: "FERNLY_JIRA_CREATE"
  });

  const replay = buildJiraPayload(deliveryInput, {
    ...reservation,
    state: "duplicate",
    occurrenceCount: 2,
    providerDeliveryKey: reservation.providerDeliveryKey,
    jiraDeliveryKey: "fernly-incident-eabf86951d6109555dcd82ab-00000002",
    sendProvider: false,
    sendJira: true
  });

  assert.equal(replay.auditAction, "FERNLY_JIRA_UPDATE");
  assertNoForbiddenContent(replay);
});
