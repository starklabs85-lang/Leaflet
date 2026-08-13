import assert from "node:assert/strict";
import test from "node:test";

import { createAppsFlyerAdapter } from "./appsFlyerAdapter";

test("ATT authorization enables identifier attribution before AppsFlyer starts", async () => {
  const calls: string[] = [];
  let initOptions: Record<string, unknown> | null = null;

  const adapter = createAppsFlyerAdapter({
    appId: "6775880316",
    createConsentData: (consent) => consent,
    devKey: "dev-key",
    isDebug: false,
    onDeepLinkIntent: async () => undefined,
    requestTrackingAuthorization: async () => {
      calls.push("request-att");
      return true;
    },
    sdk: {
      anonymizeUser: (enabled) =>
        calls.push(`anonymize:${String(enabled)}`),
      disableAdvertisingIdentifier: (disabled) =>
        calls.push(`disable-idfa:${String(disabled)}`),
      enableTCFDataCollection: (enabled) =>
        calls.push(`tcf:${String(enabled)}`),
      getAppsFlyerUID: () => undefined,
      initSdk: async (options) => {
        calls.push("init");
        initOptions = options;
        return "ok";
      },
      logEvent: async () => "ok",
      onDeepLink: () => {
        calls.push("subscribe-udl");
        return () => undefined;
      },
      setCustomerUserId: () => undefined,
      setConsentData: (consent) =>
        calls.push(`consent:${JSON.stringify(consent)}`),
      setSharingFilterForPartners: (partners) =>
        calls.push(`sharing:${partners.join(",")}`),
      startSdk: () => calls.push("start"),
      stop: () => undefined,
      updateServerUninstallToken: () => undefined
    }
  });

  await adapter.start();

  assert.deepEqual(calls, [
    "request-att",
    "subscribe-udl",
    "disable-idfa:false",
    "tcf:false",
    'consent:{"isUserSubjectToGDPR":true,"hasConsentForDataUsage":true,"hasConsentForAdsPersonalization":false,"hasConsentForAdStorage":true}',
    "init",
    "anonymize:false",
    "sharing:",
    "start"
  ]);
  assert.deepEqual(initOptions, {
    appId: "6775880316",
    devKey: "dev-key",
    isDebug: false,
    manualStart: true,
    onDeepLinkListener: true,
    onInstallConversionDataListener: false
  });
  assert.equal("timeToWaitForATTUserAuthorization" in initOptions!, false);
  assert.equal(adapter.isTrackingAuthorized(), true);
});

test("ATT denial keeps AppsFlyer anonymous and suppresses user-level attribution", async () => {
  const calls: string[] = [];
  const adapter = createAppsFlyerAdapter({
    appId: "6775880316",
    createConsentData: (consent) => consent,
    devKey: "dev-key",
    getCustomerUserId: () => "supabase-user-id",
    isDebug: false,
    onDeepLinkIntent: async () => undefined,
    requestTrackingAuthorization: async () => false,
    sdk: {
      anonymizeUser: (enabled) =>
        calls.push(`anonymize:${String(enabled)}`),
      disableAdvertisingIdentifier: (disabled) =>
        calls.push(`disable-idfa:${String(disabled)}`),
      enableTCFDataCollection: () => undefined,
      getAppsFlyerUID: () => undefined,
      initSdk: async () => "ok",
      logEvent: async () => "ok",
      onDeepLink: () => () => undefined,
      setCustomerUserId: (value) => calls.push(`cuid:${value}`),
      setConsentData: (consent) =>
        calls.push(`consent:${JSON.stringify(consent)}`),
      setSharingFilterForPartners: (partners) =>
        calls.push(`sharing:${partners.join(",")}`),
      startSdk: () => calls.push("start"),
      stop: () => undefined,
      updateServerUninstallToken: (token) =>
        calls.push(`uninstall:${token}`)
    }
  });

  await adapter.start();
  await adapter.setUser("later-user-id", {});
  await adapter.registerUninstallToken("apns-token");

  assert.deepEqual(calls, [
    "disable-idfa:true",
    'consent:{"isUserSubjectToGDPR":true,"hasConsentForDataUsage":true,"hasConsentForAdsPersonalization":false,"hasConsentForAdStorage":false}',
    "anonymize:true",
    "sharing:all",
    "start"
  ]);
  assert.equal(adapter.isTrackingAuthorized(), false);
});

test("ATT request failure fails closed without preventing anonymous measurement", async () => {
  const calls: string[] = [];
  const adapter = createAppsFlyerAdapter({
    appId: "6775880316",
    createConsentData: (consent) => consent,
    devKey: "dev-key",
    isDebug: false,
    onDeepLinkIntent: async () => undefined,
    requestTrackingAuthorization: async () => {
      throw new Error("ATT unavailable");
    },
    sdk: {
      anonymizeUser: (enabled) =>
        calls.push(`anonymize:${String(enabled)}`),
      disableAdvertisingIdentifier: (disabled) =>
        calls.push(`disable-idfa:${String(disabled)}`),
      enableTCFDataCollection: () => undefined,
      getAppsFlyerUID: () => undefined,
      initSdk: async () => "ok",
      logEvent: async () => "ok",
      onDeepLink: () => () => undefined,
      setCustomerUserId: () => calls.push("cuid"),
      setConsentData: () => undefined,
      setSharingFilterForPartners: (partners) =>
        calls.push(`sharing:${partners.join(",")}`),
      startSdk: () => calls.push("start"),
      stop: () => undefined,
      updateServerUninstallToken: () => undefined
    }
  });

  await adapter.start();

  assert.deepEqual(calls, [
    "disable-idfa:true",
    "anonymize:true",
    "sharing:all",
    "start"
  ]);
  assert.equal(adapter.isTrackingAuthorized(), false);
});

test("AppsFlyer persists only parsed deep-link intent metadata", async () => {
  const holder: {
    listener: ((payload: {
        deepLinkStatus: "FOUND";
        isDeferred: boolean;
        data: Record<string, unknown>;
      }) => void) | null;
  } = { listener: null };
  const received: unknown[] = [];

  const adapter = createAppsFlyerAdapter({
    appId: "6775880316",
    createConsentData: (consent) => consent,
    devKey: "dev-key",
    isDebug: false,
    onDeepLinkIntent: async (intent) => {
      received.push(intent);
    },
    sdk: {
      anonymizeUser: () => undefined,
      disableAdvertisingIdentifier: () => undefined,
      enableTCFDataCollection: () => undefined,
      getAppsFlyerUID: () => undefined,
      initSdk: async () => "ok",
      logEvent: async () => "ok",
      onDeepLink: (callback) => {
        holder.listener = callback as typeof holder.listener;
        return () => undefined;
      },
      setCustomerUserId: () => undefined,
      setConsentData: () => undefined,
      setSharingFilterForPartners: () => undefined,
      startSdk: () => undefined,
      stop: () => undefined,
      updateServerUninstallToken: () => undefined
    }
  });

  await adapter.start();
  assert.ok(holder.listener);
  holder.listener({
    deepLinkStatus: "FOUND",
    isDeferred: true,
    data: {
      campaign: "must-not-be-stored",
      deep_link_value: "scan",
      deep_link_sub1: "identify",
      link: "https://fernly.onelink.me/raw-secret"
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(received, [
    {
      deferred: true,
      intent: { kind: "scan", mode: "identify" }
    }
  ]);
});

test("AppsFlyer events never include client-side revenue values", async () => {
  const events: Array<{ name: string; params: Record<string, unknown> }> = [];
  const adapter = createAppsFlyerAdapter({
    appId: "6775880316",
    createConsentData: (consent) => consent,
    devKey: "dev-key",
    isDebug: false,
    onDeepLinkIntent: async () => undefined,
    sdk: {
      anonymizeUser: () => undefined,
      disableAdvertisingIdentifier: () => undefined,
      enableTCFDataCollection: () => undefined,
      getAppsFlyerUID: () => undefined,
      initSdk: async () => "ok",
      logEvent: async (name, params) => {
        events.push({ name, params });
        return "ok";
      },
      onDeepLink: () => () => undefined,
      setCustomerUserId: () => undefined,
      setConsentData: () => undefined,
      setSharingFilterForPartners: () => undefined,
      startSdk: () => undefined,
      stop: () => undefined,
      updateServerUninstallToken: () => undefined
    }
  });

  await adapter.trackAction("purchase_result", {
    af_revenue: 9.99,
    currency: "usd",
    result: "success"
  });

  assert.deepEqual(events, [
    { name: "purchase_result", params: { result: "success" } }
  ]);
});

test("sets the Supabase CUID after consent but before the AppsFlyer start event", async () => {
  const calls: string[] = [];
  const adapter = createAppsFlyerAdapter({
    appId: "6775880316",
    createConsentData: (consent) => consent,
    devKey: "dev-key",
    getCustomerUserId: () => "supabase-user-id",
    isDebug: false,
    onDeepLinkIntent: async () => undefined,
    requestTrackingAuthorization: async () => true,
    sdk: {
      anonymizeUser: () => undefined,
      disableAdvertisingIdentifier: () => undefined,
      enableTCFDataCollection: () => undefined,
      getAppsFlyerUID: () => undefined,
      initSdk: async () => {
        calls.push("init");
        return "ok";
      },
      logEvent: async () => "ok",
      onDeepLink: () => () => undefined,
      setCustomerUserId: (value) => calls.push(`cuid:${value}`),
      setConsentData: () => undefined,
      setSharingFilterForPartners: () => undefined,
      startSdk: () => calls.push("start"),
      stop: () => undefined,
      updateServerUninstallToken: () => undefined
    }
  });

  await adapter.start();

  assert.deepEqual(calls, ["init", "cuid:supabase-user-id", "start"]);
});

test("withdrawal sends a denied manual consent signal before stopping AppsFlyer", async () => {
  const calls: string[] = [];
  const adapter = createAppsFlyerAdapter({
    appId: "6775880316",
    createConsentData: (consent) => consent,
    devKey: "dev-key",
    isDebug: false,
    onDeepLinkIntent: async () => undefined,
    sdk: {
      anonymizeUser: () => undefined,
      disableAdvertisingIdentifier: () => undefined,
      enableTCFDataCollection: (enabled) =>
        calls.push(`tcf:${String(enabled)}`),
      getAppsFlyerUID: () => undefined,
      initSdk: async () => "ok",
      logEvent: async () => "ok",
      onDeepLink: () => () => undefined,
      setCustomerUserId: () => undefined,
      setConsentData: (consent) =>
        calls.push(`consent:${JSON.stringify(consent)}`),
      setSharingFilterForPartners: (partners) =>
        calls.push(`sharing:${partners.join(",")}`),
      startSdk: () => undefined,
      stop: (stopped) => calls.push(`stop:${String(stopped)}`),
      updateServerUninstallToken: () => undefined
    }
  });

  await adapter.disable();

  assert.deepEqual(calls, [
    "tcf:false",
    'consent:{"isUserSubjectToGDPR":true,"hasConsentForDataUsage":false,"hasConsentForAdsPersonalization":false,"hasConsentForAdStorage":false}',
    "sharing:all",
    "stop:true"
  ]);
});

test("re-consent refreshes the granted signal before restarting an initialized SDK", async () => {
  const calls: string[] = [];
  const adapter = createAppsFlyerAdapter({
    appId: "6775880316",
    createConsentData: (consent) => consent,
    devKey: "dev-key",
    isDebug: false,
    onDeepLinkIntent: async () => undefined,
    requestTrackingAuthorization: async () => true,
    sdk: {
      anonymizeUser: () => undefined,
      disableAdvertisingIdentifier: () => undefined,
      enableTCFDataCollection: () => undefined,
      getAppsFlyerUID: () => undefined,
      initSdk: async () => "ok",
      logEvent: async () => "ok",
      onDeepLink: () => () => undefined,
      setCustomerUserId: () => undefined,
      setConsentData: (consent) =>
        calls.push(`consent:${JSON.stringify(consent)}`),
      setSharingFilterForPartners: () => undefined,
      startSdk: () => calls.push("start"),
      stop: () => undefined,
      updateServerUninstallToken: () => undefined
    }
  });

  await adapter.start();
  await adapter.disable();
  calls.length = 0;
  await adapter.start();

  assert.deepEqual(calls, [
    'consent:{"isUserSubjectToGDPR":true,"hasConsentForDataUsage":true,"hasConsentForAdsPersonalization":false,"hasConsentForAdStorage":true}',
    "start"
  ]);
});
