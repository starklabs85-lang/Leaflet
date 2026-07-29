import assert from "node:assert/strict";
import test from "node:test";

import { isProfileTrialEligible } from "./profileTrialCta.js";

test("shows a trial when the monthly product is eligible", () => {
  assert.equal(
    isProfileTrialEligible({
      monthlyProductId: "leaflet_premium_monthly",
      trialEligibilityByProductId: {
        leaflet_premium_monthly: true
      }
    }),
    true
  );
});

test("does not promise a trial when the monthly product is ineligible or unknown", () => {
  assert.equal(
    isProfileTrialEligible({
      monthlyProductId: "leaflet_premium_monthly",
      trialEligibilityByProductId: { leaflet_premium_monthly: false }
    }),
    false
  );
  assert.equal(
    isProfileTrialEligible({
      monthlyProductId: "leaflet_premium_monthly",
      trialEligibilityByProductId: {}
    }),
    false
  );
});

test("does not promise a trial when the monthly product is absent", () => {
  assert.equal(
    isProfileTrialEligible({
      monthlyProductId: undefined,
      trialEligibilityByProductId: {}
    }),
    false
  );
});
