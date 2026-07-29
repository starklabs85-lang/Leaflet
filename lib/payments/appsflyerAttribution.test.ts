import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import {
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
