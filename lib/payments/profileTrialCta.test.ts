import assert from "node:assert/strict";
import test from "node:test";

import { isProfileTrialEligible } from "./profileTrialCta.js";

test("uses the annual plan eligibility when annual is available", () => {
  assert.equal(
    isProfileTrialEligible({
      annualProductId: "leaflet_premium_annual",
      monthlyProductId: "leaflet_premium_monthly",
      trialEligibilityByProductId: {
        leaflet_premium_annual: true,
        leaflet_premium_monthly: false
      }
    }),
    true
  );
});

test("falls back to the monthly plan when annual is unavailable", () => {
  assert.equal(
    isProfileTrialEligible({
      annualProductId: undefined,
      monthlyProductId: "leaflet_premium_monthly",
      trialEligibilityByProductId: { leaflet_premium_monthly: true }
    }),
    true
  );
});

test("does not promise a trial when the selected plan is ineligible or unknown", () => {
  assert.equal(
    isProfileTrialEligible({
      annualProductId: "leaflet_premium_annual",
      monthlyProductId: "leaflet_premium_monthly",
      trialEligibilityByProductId: { leaflet_premium_annual: false }
    }),
    false
  );
  assert.equal(
    isProfileTrialEligible({
      annualProductId: undefined,
      monthlyProductId: undefined,
      trialEligibilityByProductId: {}
    }),
    false
  );
});
