import assert from "node:assert/strict";
import test from "node:test";

import {
  IDENTIFICATION_COMPARISON_ROW,
  PREMIUM_PAYWALL_DESCRIPTION
} from "./paywallCopy.js";

test("paywall explains that identification follows Premium activation", () => {
  assert.match(PREMIUM_PAYWALL_DESCRIPTION, /after Premium activates/i);
  assert.doesNotMatch(PREMIUM_PAYWALL_DESCRIPTION, /free.*scan|scan.*per day/i);
});

test("paywall comparison makes identification unavailable on Free", () => {
  assert.deepEqual(IDENTIFICATION_COMPARISON_ROW, {
    feature: "Plant identification",
    freeIncluded: false,
    premiumLabel: "Unlimited"
  });
});
