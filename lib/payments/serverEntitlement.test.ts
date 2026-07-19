import assert from "node:assert/strict";
import test from "node:test";

import {
  isActiveServerPremium,
  shouldContinueAfterPremiumOutcome,
  waitForServerPremiumEntitlement
} from "./serverEntitlement.js";

test("recognizes only an unexpired Premium server entitlement", () => {
  const now = Date.parse("2026-07-19T12:00:00.000Z");

  assert.equal(isActiveServerPremium({ plan: "premium", expires_at: null }, now), true);
  assert.equal(
    isActiveServerPremium({ plan: "premium", expires_at: "2026-07-20T12:00:00.000Z" }, now),
    true
  );
  assert.equal(
    isActiveServerPremium({ plan: "premium", expires_at: "2026-07-18T12:00:00.000Z" }, now),
    false
  );
  assert.equal(isActiveServerPremium({ plan: "free", expires_at: null }, now), false);
});

test("waits for the RevenueCat webhook to publish Premium", async () => {
  const reads = [
    { plan: "free", expires_at: null },
    { plan: "premium", expires_at: null }
  ];
  const waits: number[] = [];

  const ready = await waitForServerPremiumEntitlement({
    delaysMs: [0, 250, 500],
    now: () => Date.parse("2026-07-19T12:00:00.000Z"),
    read: async () => reads.shift() ?? null,
    wait: async (delayMs) => {
      waits.push(delayMs);
    }
  });

  assert.equal(ready, true);
  assert.deepEqual(waits, [250]);
});

test("returns false without unlocking when server entitlement never arrives", async () => {
  const ready = await waitForServerPremiumEntitlement({
    delaysMs: [0, 250],
    read: async () => null,
    wait: async () => undefined
  });

  assert.equal(ready, false);
});

test("continues captured photos after purchases and restores only", () => {
  assert.equal(shouldContinueAfterPremiumOutcome("purchased"), true);
  assert.equal(shouldContinueAfterPremiumOutcome("restored"), true);
  assert.equal(shouldContinueAfterPremiumOutcome("cancelled"), false);
  assert.equal(shouldContinueAfterPremiumOutcome("nothing_to_restore"), false);
  assert.equal(shouldContinueAfterPremiumOutcome("error"), false);
});
