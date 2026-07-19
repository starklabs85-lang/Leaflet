import assert from "node:assert/strict";
import test from "node:test";

import { getIdentificationAccess } from "./identificationAccess.js";

test("requires Premium before plant identification", () => {
  assert.deepEqual(getIdentificationAccess(false), {
    allowed: false,
    remaining: 0,
    message: "Start a trial or subscribe to Premium to identify this plant."
  });
});

test("allows active Premium users to identify without a product limit", () => {
  assert.deepEqual(getIdentificationAccess(true), {
    allowed: true,
    remaining: null
  });
});
