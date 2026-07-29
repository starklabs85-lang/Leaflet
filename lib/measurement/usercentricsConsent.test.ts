import { equal } from "node:assert/strict";
import { test } from "node:test";

import { evaluateMeasurementConsent } from "./usercentricsConsent";

test("requires a banner when Usercentrics says consent must be collected", () => {
  equal(
    evaluateMeasurementConsent({
      shouldCollectConsent: true,
      consents: []
    }),
    "required"
  );
});

test("grants measurement only when every configured non-essential service is accepted", () => {
  equal(
    evaluateMeasurementConsent({
      shouldCollectConsent: false,
      consents: [
        { isEssential: true, status: true },
        { isEssential: false, status: true },
        { isEssential: false, status: true }
      ]
    }),
    "granted"
  );
  equal(
    evaluateMeasurementConsent({
      shouldCollectConsent: false,
      consents: [
        { isEssential: true, status: true },
        { isEssential: false, status: false }
      ]
    }),
    "denied"
  );
});

test("missing measurement services fails closed", () => {
  equal(
    evaluateMeasurementConsent({
      shouldCollectConsent: false,
      consents: [{ isEssential: true, status: true }]
    }),
    "denied"
  );
});
