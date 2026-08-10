import assert from "node:assert/strict";
import test from "node:test";

import { canonicalIncident } from "../_shared/production-ops/canonical.ts";
import { parseIncidentRequest } from "../_shared/production-ops/contract.ts";
import { handleProductionIncident } from "./handler.ts";

const secret = "0123456789abcdef0123456789abcdef";
const body = {
  appId: "fernly",
  environment: "production",
  category: "production_canary",
  code: "controlled_test",
  severity: "critical",
  occurredAt: "2026-08-11T00:00:00.000Z",
  nonce: "0123456789abcdef0123456789abcdef",
  idempotencyKey: "abcdef0123456789abcdef0123456789"
};

async function signature(input: typeof body) {
  const parsed = parseIncidentRequest(input);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    throw new Error("test fixture must be valid");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const canonical = canonicalIncident(parsed.value);
  const signed = `${input.occurredAt}.${input.nonce}.${canonical}`;
  const value = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
  const hex = Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256=${hex}`;
}

async function request(input: Record<string, unknown>, inputSignature?: string) {
  return new Request("https://example.invalid/production-incident", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-fernly-timestamp": String(input.occurredAt),
      "x-fernly-nonce": String(input.nonce),
      "x-fernly-signature": inputSignature ?? (await signature(input as typeof body))
    },
    body: JSON.stringify(input)
  });
}

function dependencies() {
  let reservationCalls = 0;

  return {
    value: {
      now: () => new Date("2026-08-11T00:02:00.000Z"),
      operationsSecret: secret,
      reserve: async () => {
        reservationCalls += 1;
        return { state: "dormant" as const };
      }
    },
    reservationCalls: () => reservationCalls
  };
}

test("wrong app is rejected before reservation", async () => {
  const deps = dependencies();
  const response = await handleProductionIncident(
    await request({ ...body, appId: "clara" }, `sha256=${"0".repeat(64)}`),
    deps.value
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { ok: false, code: "wrong_app" });
  assert.equal(deps.reservationCalls(), 0);
});

test("wrong signature is rejected before reservation", async () => {
  const deps = dependencies();
  const response = await handleProductionIncident(
    await request(body, `sha256=${"0".repeat(64)}`),
    deps.value
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { ok: false, code: "unauthorized" });
  assert.equal(deps.reservationCalls(), 0);
});

test("valid signed operations traffic reaches reservation once", async () => {
  const deps = dependencies();
  const response = await handleProductionIncident(await request(body), deps.value);

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ok: true, state: "dormant" });
  assert.equal(deps.reservationCalls(), 1);
});
