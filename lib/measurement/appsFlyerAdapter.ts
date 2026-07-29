import type {
  AnalyticsUserProperties,
  SanitizedAnalyticsParams
} from "@/lib/analytics/events";
import type { MeasurementAdapter } from "@/lib/analytics/measurementCore";
import { parseOneLinkPayload } from "@/lib/deepLinks/oneLink";
import type { ReceivedDeepLinkIntent } from "@/lib/deepLinks/pendingOneLink";

type AppsFlyerSdk = {
  anonymizeUser: (enabled: boolean) => void;
  disableAdvertisingIdentifier: (disabled: boolean) => void;
  enableTCFDataCollection: (enabled: boolean) => void;
  getAppsFlyerUID: (
    callback: (error: Error | null, uid: string | null) => void
  ) => void;
  initSdk: (options: {
    appId: string;
    devKey: string;
    isDebug: boolean;
    manualStart: boolean;
    onDeepLinkListener: boolean;
    onInstallConversionDataListener: boolean;
  }) => Promise<string>;
  logEvent: (
    name: string,
    params: Record<string, unknown>
  ) => Promise<string>;
  onDeepLink: (
    callback: (payload: {
      deepLinkStatus: "ERROR" | "FOUND" | "NOT_FOUND";
      isDeferred: boolean;
      data: Record<string, unknown>;
    }) => void
  ) => () => void;
  setCustomerUserId: (userId: string) => void;
  setSharingFilterForPartners: (partners: string[]) => void;
  startSdk: () => void;
  stop: (stopped: boolean) => void;
  updateServerUninstallToken: (token: string) => void;
};

type AppsFlyerAdapterOptions = {
  appId: string;
  devKey: string;
  getCustomerUserId?: () => string | null;
  isDebug: boolean;
  onDeepLinkIntent: (received: ReceivedDeepLinkIntent) => Promise<void>;
  sdk: AppsFlyerSdk;
};

const REVENUE_PARAMETER_KEYS = new Set([
  "af_currency",
  "af_price",
  "af_quantity",
  "af_revenue",
  "currency",
  "price",
  "quantity",
  "revenue"
]);

export function createAppsFlyerAdapter({
  appId,
  devKey,
  getCustomerUserId = () => null,
  isDebug,
  onDeepLinkIntent,
  sdk
}: AppsFlyerAdapterOptions): MeasurementAdapter & {
  getAppsFlyerUid: () => Promise<string | null>;
  registerUninstallToken: (token: string) => Promise<void>;
} {
  let initialized = false;

  return {
    async start() {
      if (!initialized) {
        sdk.onDeepLink((payload) => {
          if (payload.deepLinkStatus !== "FOUND") {
            void onDeepLinkIntent({
              deferred: payload.isDeferred === true,
              intent: { kind: "home" }
            }).catch(() => undefined);
            return;
          }

          const intent = parseOneLinkPayload(payload.data) ?? { kind: "home" };

          void onDeepLinkIntent({
            deferred: payload.isDeferred === true,
            intent
          }).catch(() => undefined);
        });
        sdk.disableAdvertisingIdentifier(true);
        sdk.enableTCFDataCollection(true);
        await sdk.initSdk({
          appId,
          devKey,
          isDebug,
          manualStart: true,
          onDeepLinkListener: true,
          onInstallConversionDataListener: false
        });
        initialized = true;
      }

      const customerUserId = getCustomerUserId();

      if (customerUserId) {
        sdk.setCustomerUserId(customerUserId);
      }
      sdk.anonymizeUser(false);
      sdk.setSharingFilterForPartners([]);
      sdk.stop(false);
      sdk.startSdk();
    },

    async disable() {
      sdk.setSharingFilterForPartners(["all"]);
      sdk.stop(true);
    },

    async trackAction(name, params) {
      const funnelOnlyParams = Object.fromEntries(
        Object.entries(params).filter(
          ([key]) => !REVENUE_PARAMETER_KEYS.has(key)
        )
      );

      await sdk.logEvent(name, funnelOnlyParams);
    },

    async trackScreenView(name) {
      await sdk.logEvent("screen_view", {
        screen_class: name,
        screen_name: name
      });
    },

    async setUser(userId: string, _properties: AnalyticsUserProperties) {
      sdk.anonymizeUser(false);
      sdk.setCustomerUserId(userId);
    },

    async clearUser() {
      sdk.anonymizeUser(true);
    },

    async getAppsFlyerUid() {
      return new Promise<string | null>((resolve) => {
        sdk.getAppsFlyerUID((error, uid) => {
          resolve(error || !uid ? null : uid);
        });
      });
    },

    async registerUninstallToken(token: string) {
      if (token) {
        sdk.updateServerUninstallToken(token);
      }
    }
  };
}

export async function loadAppsFlyerSdk(): Promise<AppsFlyerSdk> {
  const imported = await import("react-native-appsflyer");
  return imported.default as AppsFlyerSdk;
}
