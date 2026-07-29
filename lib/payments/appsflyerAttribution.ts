type AppsFlyerAttributionDependencies = {
  getAppsFlyerUid: () => Promise<string | null>;
  setAppsFlyerId: (value: string | null) => Promise<void>;
};

export const REVENUECAT_APPSFLYER_SHARING_FILTER =
  "$appsflyerSharingFilter";

export function getRevenueCatAppsFlyerSharingAttributes(allowed: boolean) {
  return {
    [REVENUECAT_APPSFLYER_SHARING_FILTER]: allowed ? null : "all"
  };
}

export async function syncAppsFlyerAttribution({
  getAppsFlyerUid,
  setAppsFlyerId
}: AppsFlyerAttributionDependencies) {
  try {
    const uid = await getAppsFlyerUid();

    if (!uid) {
      return false;
    }

    await setAppsFlyerId(uid);
    return true;
  } catch {
    return false;
  }
}
