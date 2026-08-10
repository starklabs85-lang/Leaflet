import assert from "node:assert/strict";
import test from "node:test";

import { verifyOperationsSignature } from "./auth.ts";

const secret = "0123456789abcdef0123456789abcdef";
const timestamp = "2026-08-11T00:00:00.000Z";
const nonce = "0123456789abcdef0123456789abcdef";
const canonical = [
  "fernly",
  "production",
  "production_canary",
  "controlled_test",
  "critical",
  timestamp,
  nonce,
  "abcdef0123456789abcdef0123456789"
].join("\n");

async function sign(inputCanonical = canonical, inputTimestamp = timestamp, inputNonce = nonce) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = new TextEncoder().encode(`${inputTimestamp}.${inputNonce}.${inputCanonical}`);
  const value = await crypto.subtle.sign("HMAC", key, data);
  const hex = Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256=${hex}`;
}

async function validHeaders() {
  return new Headers({
    "x-fernly-timestamp": timestamp,
    "x-fernly-nonce": nonce,
    "x-fernly-signature": await sign()
  });
}

test("authorizes a fresh Fernly HMAC signature", async () => {
  const result = await verifyOperationsSignature(
    await validHeaders(),
    canonical,
    new Date("2026-08-11T00:02:00.000Z"),
    secret
  );

  assert.deepEqual(result, { status: "authorized", timestamp, nonce });
});

test("rejects a wrong signature", async () => {
  const headers = await validHeaders();
  headers.set("x-fernly-signature", `sha256=${"0".repeat(64)}`);

  assert.deepEqual(
    await verifyOperationsSignature(
      headers,
      canonical,
      new Date("2026-08-11T00:02:00.000Z"),
      secret
    ),
    { status: "unauthorized" }
  );
});

test("rejects missing or malformed authentication headers", async () => {
  const malformed = [
    new Headers(),
    new Headers({
      "x-fernly-timestamp": "2026-08-11T00:00:00Z",
      "x-fernly-nonce": nonce,
      "x-fernly-signature": await sign()
    }),
    new Headers({
      "x-fernly-timestamp": timestamp,
      "x-fernly-nonce": "0123456789abcdef",
      "x-fernly-signature": await sign()
    }),
    new Headers({
      "x-fernly-timestamp": timestamp,
      "x-fernly-nonce": nonce,
      "x-fernly-signature": "sha256=ABCDEF"
    })
  ];

  for (const headers of malformed) {
    assert.deepEqual(
      await verifyOperationsSignature(
        headers,
        canonical,
        new Date("2026-08-11T00:02:00.000Z"),
        secret
      ),
      { status: "malformed" }
    );
  }
});

test("rejects signatures outside the five-minute replay window", async () => {
  const headers = await validHeaders();

  assert.deepEqual(
    await verifyOperationsSignature(
      headers,
      canonical,
      new Date("2026-08-11T00:05:00.001Z"),
      secret
    ),
    { status: "expired" }
  );

  assert.deepEqual(
    await verifyOperationsSignature(
      headers,
      canonical,
      new Date("2026-08-10T23:54:59.999Z"),
      secret
    ),
    { status: "expired" }
  );
});
