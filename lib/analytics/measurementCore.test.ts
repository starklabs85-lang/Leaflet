import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import {
  createMeasurementController,
  type MeasurementAdapter,
  type MeasurementConsentAdapter
} from "./measurementCore";

function createAdapter() {
  const calls: Array<{ name: string; value?: unknown }> = [];
  const adapter: MeasurementAdapter = {
    clearUser: async () => {
      calls.push({ name: "clear_user" });
    },
    disable: async () => {
      calls.push({ name: "disable" });
    },
    setUser: async (userId, properties) => {
      calls.push({ name: "set_user", value: { userId, properties } });
    },
    start: async () => {
      calls.push({ name: "start" });
    },
    trackAction: async (name, params) => {
      calls.push({ name: "action", value: { name, params } });
    },
    trackScreenView: async (name) => {
      calls.push({ name: "screen", value: name });
    }
  };

  return { adapter, calls };
}

function createConsentAdapter(
  initializeResult: "granted" | "denied" | "required",
  applyResult: "granted" | "denied" = "granted"
) {
  const adapter: MeasurementConsentAdapter = {
    applyConsent: async () => applyResult,
    initialize: async () => initializeResult
  };

  return adapter;
}

test("waiting consent sends nothing and never replays pre-consent events", async () => {
  const firebase = createAdapter();
  const appsFlyer = createAdapter();
  const controller = createMeasurementController({
    appsFlyer: appsFlyer.adapter,
    consent: createConsentAdapter("required"),
    firebase: firebase.adapter,
    resolveAppsFlyerEventName: (name) => name
  });

  equal(await controller.initializeMeasurement(), "waiting_for_consent");
  await controller.trackAction("scan_submit", { mode: "identify" });
  equal(await controller.applyMeasurementConsent(), "started");

  deepEqual(firebase.calls, [{ name: "start" }]);
  deepEqual(appsFlyer.calls, [{ name: "start" }]);
});

test("consent rejection disables both adapters and drops future events", async () => {
  const firebase = createAdapter();
  const appsFlyer = createAdapter();
  const controller = createMeasurementController({
    appsFlyer: appsFlyer.adapter,
    consent: createConsentAdapter("required", "denied"),
    firebase: firebase.adapter,
    resolveAppsFlyerEventName: (name) => name
  });

  await controller.initializeMeasurement();
  equal(await controller.applyMeasurementConsent(), "disabled");
  await controller.trackScreenView("home");

  deepEqual(firebase.calls, [{ name: "disable" }]);
  deepEqual(appsFlyer.calls, [{ name: "disable" }]);
});

test("started measurement routes a sanitized event to both adapters", async () => {
  const firebase = createAdapter();
  const appsFlyer = createAdapter();
  const controller = createMeasurementController({
    appsFlyer: appsFlyer.adapter,
    consent: createConsentAdapter("granted"),
    firebase: firebase.adapter,
    resolveAppsFlyerEventName: (name, params) =>
      name === "identify_result" && params.result === "success"
        ? "af_search"
        : name,
    sanitizeParams: (_name, params) => ({
      result: params?.result === "success" ? "success" : "failure"
    })
  });

  equal(await controller.initializeMeasurement(), "started");
  await controller.trackAction("identify_result", {
    email: "private@example.com",
    result: "success"
  });

  deepEqual(firebase.calls, [
    { name: "start" },
    {
      name: "action",
      value: { name: "identify_result", params: { result: "success" } }
    }
  ]);
  deepEqual(appsFlyer.calls, [
    { name: "start" },
    {
      name: "action",
      value: { name: "af_search", params: { result: "success" } }
    }
  ]);
});

test("centralized screen views route to both adapters after consent", async () => {
  const firebase = createAdapter();
  const appsFlyer = createAdapter();
  const controller = createMeasurementController({
    appsFlyer: appsFlyer.adapter,
    consent: createConsentAdapter("granted"),
    firebase: firebase.adapter,
    resolveAppsFlyerEventName: (name) => name
  });

  await controller.initializeMeasurement();
  await controller.trackScreenView("auth_tabs_home");

  deepEqual(firebase.calls, [
    { name: "start" },
    { name: "screen", value: "auth_tabs_home" }
  ]);
  deepEqual(appsFlyer.calls, [
    { name: "start" },
    { name: "screen", value: "auth_tabs_home" }
  ]);
});

test("CMP failure keeps the app usable with measurement disabled", async () => {
  const firebase = createAdapter();
  const appsFlyer = createAdapter();
  const controller = createMeasurementController({
    appsFlyer: appsFlyer.adapter,
    consent: {
      applyConsent: async () => "denied",
      initialize: async () => {
        throw new Error("CMP unavailable");
      }
    },
    firebase: firebase.adapter,
    resolveAppsFlyerEventName: (name) => name
  });

  equal(await controller.initializeMeasurement(), "disabled");
  deepEqual(firebase.calls, [{ name: "disable" }]);
  deepEqual(appsFlyer.calls, [{ name: "disable" }]);
});

test("identity clearing reaches both SDKs even after measurement is disabled", async () => {
  const firebase = createAdapter();
  const appsFlyer = createAdapter();
  const controller = createMeasurementController({
    appsFlyer: appsFlyer.adapter,
    consent: createConsentAdapter("denied"),
    firebase: firebase.adapter,
    resolveAppsFlyerEventName: (name) => name
  });

  equal(await controller.initializeMeasurement(), "disabled");
  await controller.clearAnalyticsUser();

  deepEqual(firebase.calls, [{ name: "disable" }, { name: "clear_user" }]);
  deepEqual(appsFlyer.calls, [{ name: "disable" }, { name: "clear_user" }]);
});
