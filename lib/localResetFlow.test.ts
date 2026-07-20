import assert from "node:assert/strict";
import test from "node:test";

import { runLocalResetSteps } from "./localResetFlow.js";

test("finishes essential reset steps before best-effort cleanup", async () => {
  const calls: string[] = [];

  await runLocalResetSteps({
    essential: [async () => calls.push("essential")],
    cleanup: [async () => calls.push("cleanup")]
  });

  assert.deepEqual(calls, ["essential", "cleanup"]);
});

test("does not continue when essential auth or onboarding cleanup fails", async () => {
  let cleanupRan = false;

  await assert.rejects(
    runLocalResetSteps({
      essential: [async () => Promise.reject(new Error("secure reset failed"))],
      cleanup: [async () => {
        cleanupRan = true;
      }]
    }),
    /secure reset failed/
  );

  assert.equal(cleanupRan, false);
});

test("does not restore old state when nonessential cleanup fails", async () => {
  await assert.doesNotReject(
    runLocalResetSteps({
      essential: [async () => undefined],
      cleanup: [async () => Promise.reject(new Error("cache unavailable"))]
    })
  );
});
