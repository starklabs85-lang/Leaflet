import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import {
  applyAppsFlyerPartnerAccess,
  getRevenueCatAppsFlyerSharingAttributes,
  syncAppsFlyerAttribution
} from "./appsflyerAttribution";

test("blocks RevenueCat AppsFlyer partner sharing until consent", () => {
  deepEqual(getRevenueCatAppsFlyerSharingAttributes(false), {
    $appsflyerSharingFilter: "all"
  });
});

test("removes the RevenueCat sharing filter after consent", () => {
  deepEqual(getRevenueCatAppsFlyerSharingAttributes(true), {
    $appsflyerSharingFilter: null
  });
});

test("sets only the AppsFlyer UID on RevenueCat after measurement consent", async () => {
  const attributes: Array<{ key: string; value: string | null }> = [];
  const result = await syncAppsFlyerAttribution({
    getAppsFlyerUid: async () => "install-uid",
    setAppsFlyerId: async (value) => {
      attributes.push({ key: "$appsflyerId", value });
    }
  });

  equal(result, true);
  deepEqual(attributes, [{ key: "$appsflyerId", value: "install-uid" }]);
});

test("does not block purchase flows when the AppsFlyer UID is unavailable", async () => {
  let setCalled = false;
  const result = await syncAppsFlyerAttribution({
    getAppsFlyerUid: async () => null,
    setAppsFlyerId: async () => {
      setCalled = true;
    }
  });

  equal(result, false);
  equal(setCalled, false);
});

test("ATT authorization enables RevenueCat attribution and uninstall measurement", async () => {
  const calls: string[] = [];
  const syncAttribution = async () => {
    calls.push("sync");
  };
  await applyAppsFlyerPartnerAccess({
    allowed: true,
    registerAttributionSync: (sync) =>
      calls.push(sync === syncAttribution ? "register" : "unregister"),
    registerUninstallToken: async () => {
      calls.push("uninstall");
    },
    setAppsFlyerId: async (value) => {
      calls.push(`id:${String(value)}`);
    },
    setSharingAllowed: async (allowed) => {
      calls.push(`sharing:${String(allowed)}`);
    },
    syncAttribution
  });

  deepEqual(calls, ["register", "sharing:true", "sync", "uninstall"]);
});

test("ATT denial clears RevenueCat attribution without calling identifier services", async () => {
  const calls: string[] = [];

  await applyAppsFlyerPartnerAccess({
    allowed: false,
    registerAttributionSync: (sync) =>
      calls.push(sync === null ? "unregister" : "register"),
    registerUninstallToken: async () => {
      calls.push("uninstall");
    },
    setAppsFlyerId: async (value) => {
      calls.push(`id:${String(value)}`);
    },
    setSharingAllowed: async (allowed) => {
      calls.push(`sharing:${String(allowed)}`);
    },
    syncAttribution: async () => {
      calls.push("sync");
    }
  });

  deepEqual(calls, ["unregister", "sharing:false", "id:null"]);
});
