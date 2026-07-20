import assert from "node:assert/strict";
import test from "node:test";

import {
  decideInstallAction,
  writeInstallMarkersSafely
} from "./installState.js";

test("keeps normal launches unchanged when both install markers exist", () => {
  assert.equal(
    decideInstallAction({ durableMarker: true, volatileMarker: true }),
    "continue"
  );
});

test("detects an iOS reinstall when only the durable marker survives", () => {
  assert.equal(
    decideInstallAction({ durableMarker: true, volatileMarker: false }),
    "reset_reinstall"
  );
});

test("preserves first launches and legacy upgrades when neither marker exists", () => {
  assert.equal(
    decideInstallAction({ durableMarker: false, volatileMarker: false }),
    "initialize"
  );
});

test("repairs a missing durable marker without resetting local state", () => {
  assert.equal(
    decideInstallAction({ durableMarker: false, volatileMarker: true }),
    "repair_durable"
  );
});

test("writes the uninstall-cleared marker before the durable marker", async () => {
  const calls: string[] = [];

  await writeInstallMarkersSafely({
    writeVolatile: async () => calls.push("volatile"),
    writeDurable: async () => calls.push("durable")
  });

  assert.deepEqual(calls, ["volatile", "durable"]);
});

test("never leaves durable-only state when volatile initialization fails", async () => {
  let durableWritten = false;

  await assert.rejects(
    writeInstallMarkersSafely({
      writeVolatile: async () => Promise.reject(new Error("sandbox unavailable")),
      writeDurable: async () => {
        durableWritten = true;
      }
    }),
    /sandbox unavailable/
  );

  assert.equal(durableWritten, false);
});
