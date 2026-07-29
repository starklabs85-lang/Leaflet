import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  ANALYTICS_EVENT_CATALOG,
  ANALYTICS_EVENTS,
  resolveAppsFlyerEventName,
  sanitizeDeclaredAnalyticsParams
} from "./events";
import {
  ANALYTICS_EVENTS as GENERATED_ANALYTICS_EVENTS,
  ANALYTICS_TAPS as GENERATED_ANALYTICS_TAPS,
  GENERATED_EVENT_DEFINITIONS
} from "./events.generated";
import { ANALYTICS_TAPS } from "./events";

test("every generated event constant has one catalog entry", () => {
  const names = Object.values(ANALYTICS_EVENTS);

  equal(names.length, new Set(names).size);
  deepEqual(
    [...Object.keys(ANALYTICS_EVENT_CATALOG)].sort(),
    [...names].sort()
  );

  for (const definition of Object.values(ANALYTICS_EVENT_CATALOG)) {
    deepEqual(definition.routes, { appsFlyer: true, firebase: true });
  }
});

test("runtime constants and mappings exactly match generated manifest output", () => {
  deepEqual(ANALYTICS_EVENTS, GENERATED_ANALYTICS_EVENTS);
  deepEqual(ANALYTICS_TAPS, GENERATED_ANALYTICS_TAPS);
  deepEqual(ANALYTICS_EVENT_CATALOG, GENERATED_EVENT_DEFINITIONS);
});

test("canonical AppsFlyer aliases apply only to their declared success milestone", () => {
  equal(
    resolveAppsFlyerEventName("identify_result", { result: "success" }),
    "af_search"
  );
  equal(
    resolveAppsFlyerEventName("identify_result", { result: "failure" }),
    "identify_result"
  );
  equal(
    resolveAppsFlyerEventName("onboarding_complete", { method: "plant_save" }),
    "af_tutorial_completion"
  );
  equal(resolveAppsFlyerEventName("paywall_view", {}), "af_content_view");
  equal(
    resolveAppsFlyerEventName("purchase_start", {}),
    "af_initiated_checkout"
  );
});

test("runtime validation drops undeclared and prohibited parameters", () => {
  const params = sanitizeDeclaredAnalyticsParams("purchase_start", {
    email: "private@example.com",
    plan: "annual",
    raw_error: "secret stack",
    source: "paywall",
    trial_eligible: true,
    unknown_parameter: "drop me"
  });

  deepEqual(params, {
    plan: "annual",
    source: "paywall",
    trial_eligible: true
  });
});

test("catalog never allows revenue or direct identifier fields from the client", () => {
  for (const event of Object.values(ANALYTICS_EVENT_CATALOG)) {
    const parameterNames = Object.keys(event.parameters);

    ok(!parameterNames.includes("af_revenue"));
    ok(!parameterNames.includes("revenue"));
    ok(!parameterNames.includes("price"));
    ok(!parameterNames.includes("currency"));
    ok(!parameterNames.includes("email"));
    ok(!parameterNames.includes("plant_name"));
    ok(!parameterNames.includes("url"));
  }
});
