import assert from "node:assert/strict";
import test from "node:test";

import { getScanAccess } from "./access.js";

test("blocks both identification and diagnosis without Premium", () => {
  assert.deepEqual(getScanAccess({ isPremium: false, scanType: "identify" }), {
    allowed: false,
    code: "premium_required",
    message: "Start a trial or subscribe to Premium to identify this plant."
  });
  assert.deepEqual(getScanAccess({ isPremium: false, scanType: "diagnose" }), {
    allowed: false,
    code: "premium_required",
    message: "Disease diagnosis is included with Premium."
  });
});

test("allows both scan types with Premium", () => {
  assert.deepEqual(getScanAccess({ isPremium: true, scanType: "identify" }), {
    allowed: true
  });
  assert.deepEqual(getScanAccess({ isPremium: true, scanType: "diagnose" }), {
    allowed: true
  });
});
