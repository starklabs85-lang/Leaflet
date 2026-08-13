type AppsFlyerAttributionDependencies = {
  getAppsFlyerUid: () => Promise<string | null>;
  setAppsFlyerId: (value: string | null) => Promise<void>;
};

type AppsFlyerPartnerAccessDependencies = {
  allowed: boolean;
  registerAttributionSync: (
    sync: (() => Promise<void>) | null
  ) => void;
  registerUninstallToken: () => Promise<void>;
  setAppsFlyerId: (value: string | null) => Promise<void>;
  setSharingAllowed: (allowed: boolean) => Promise<void>;
  syncAttribution: () => Promise<void>;
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

export async function applyAppsFlyerPartnerAccess({
  allowed,
  registerAttributionSync,
  registerUninstallToken,
  setAppsFlyerId,
  setSharingAllowed,
  syncAttribution
}: AppsFlyerPartnerAccessDependencies) {
  if (allowed) {
    registerAttributionSync(syncAttribution);
    await setSharingAllowed(true).catch(() => undefined);
    await Promise.allSettled([
      syncAttribution(),
      registerUninstallToken()
    ]);
    return;
  }

  registerAttributionSync(null);
  await Promise.allSettled([
    setSharingAllowed(false),
    setAppsFlyerId(null)
  ]);
}
