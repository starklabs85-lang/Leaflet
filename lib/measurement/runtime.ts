import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import {
  resolveAppsFlyerEventName,
  sanitizeDeclaredAnalyticsParams,
  type AnalyticsEventName,
  type AnalyticsParams,
  type AnalyticsUserProperties
} from "@/lib/analytics/events";
import {
  createMeasurementController,
  type MeasurementState
} from "@/lib/analytics/measurementCore";
import { storePendingDeepLink } from "@/lib/deepLinks/pendingOneLink";
import { env, hasMeasurementConfig } from "@/lib/env";
import {
  registerRevenueCatAttributionSync,
  setRevenueCatAppsFlyerId,
  setRevenueCatAppsFlyerSharingAllowed
} from "@/lib/payments/revenuecat";
import { syncAppsFlyerAttribution } from "@/lib/payments/appsflyerAttribution";

import {
  createAppsFlyerAdapter,
  loadAppsFlyerSdk
} from "./appsFlyerAdapter";
import { createFirebaseMeasurementAdapter } from "./firebaseAdapter";
import {
  createUsercentricsConsentAdapter,
  type UsercentricsConsentAdapter
} from "./usercentricsConsent";

type MeasurementController = ReturnType<typeof createMeasurementController>;
type AppsFlyerAdapter = ReturnType<typeof createAppsFlyerAdapter>;

let controller: MeasurementController | null = null;
let appsFlyerAdapter: AppsFlyerAdapter | null = null;
let consentAdapter: UsercentricsConsentAdapter | null = null;
let initializationPromise: Promise<MeasurementController | null> | null = null;
let pendingUser: {
  id: string;
  properties: AnalyticsUserProperties;
} | null = null;

async function prepareController() {
  if (controller) {
    return controller;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    if (Platform.OS !== "ios" || !hasMeasurementConfig()) {
      return null;
    }

    const sdk = await loadAppsFlyerSdk();
    appsFlyerAdapter = createAppsFlyerAdapter({
      appId: env.appsFlyerIosAppId,
      devKey: env.appsFlyerDevKey,
      getCustomerUserId: () => pendingUser?.id ?? null,
      isDebug: __DEV__,
      onDeepLinkIntent: storePendingDeepLink,
      sdk
    });
    consentAdapter = createUsercentricsConsentAdapter(
      env.usercentricsSettingsId
    );
    controller = createMeasurementController({
      appsFlyer: appsFlyerAdapter,
      consent: consentAdapter,
      firebase: createFirebaseMeasurementAdapter(),
      isConfigured: hasMeasurementConfig,
      resolveAppsFlyerEventName: (name, params) =>
        resolveAppsFlyerEventName(name as AnalyticsEventName, params),
      sanitizeParams: (name, params) =>
        sanitizeDeclaredAnalyticsParams(name as AnalyticsEventName, params)
    });

    registerRevenueCatAttributionSync(syncAttribution);
    return controller;
  })().catch(() => null);

  return initializationPromise;
}

async function syncAttribution() {
  if (!appsFlyerAdapter || controller?.getState() !== "started") {
    return;
  }

  await syncAppsFlyerAttribution({
    getAppsFlyerUid: appsFlyerAdapter.getAppsFlyerUid,
    setAppsFlyerId: setRevenueCatAppsFlyerId
  });
}

async function registerUninstallToken() {
  if (!appsFlyerAdapter || Platform.OS !== "ios") {
    return;
  }

  try {
    const token = await Notifications.getDevicePushTokenAsync();

    if (typeof token.data === "string") {
      await appsFlyerAdapter.registerUninstallToken(token.data);
    }
  } catch {
    // APNs registration is best-effort and independent of app availability.
  }
}

async function finishState(state: MeasurementState) {
  if (state === "started") {
    await setRevenueCatAppsFlyerSharingAllowed(true).catch(() => undefined);
    await Promise.allSettled([
      syncAttribution(),
      registerUninstallToken(),
      pendingUser
        ? controller?.setAnalyticsUser(
            pendingUser.id,
            pendingUser.properties
          ) ?? Promise.resolve()
        : Promise.resolve()
    ]);
  } else {
    registerRevenueCatAttributionSync(null);
    await Promise.allSettled([
      setRevenueCatAppsFlyerSharingAllowed(false),
      setRevenueCatAppsFlyerId(null)
    ]);
  }

  return state;
}

export async function initializeMeasurement(): Promise<MeasurementState> {
  const prepared = await prepareController();

  if (!prepared) {
    return finishState("misconfigured");
  }

  return finishState(await prepared.initializeMeasurement());
}

export async function applyMeasurementConsent(): Promise<MeasurementState> {
  const prepared = await prepareController();

  if (!prepared) {
    return finishState("misconfigured");
  }

  const state = await prepared.applyMeasurementConsent();

  if (state === "started") {
    registerRevenueCatAttributionSync(syncAttribution);
  }

  return finishState(state);
}

export async function showPrivacyChoices(): Promise<MeasurementState> {
  const prepared = await prepareController();

  if (!prepared || !consentAdapter) {
    return finishState("misconfigured");
  }

  await consentAdapter.showPrivacyChoices();
  return applyMeasurementConsent();
}

export async function trackAction(
  name: AnalyticsEventName,
  params?: AnalyticsParams
) {
  await controller?.trackAction(name, params);
}

export async function trackScreenView(name: string) {
  await controller?.trackScreenView(name);
}

export async function setAnalyticsUser(
  userId: string,
  properties: AnalyticsUserProperties = {}
) {
  pendingUser = { id: userId, properties };

  if (controller?.getState() === "started") {
    await controller.setAnalyticsUser(userId, properties);
  }
}

export async function clearAnalyticsUser() {
  pendingUser = null;
  await controller?.clearAnalyticsUser();
  await setRevenueCatAppsFlyerId(null).catch(() => undefined);
}

export async function getAppsFlyerUidForDeletion() {
  if (!appsFlyerAdapter) {
    return null;
  }

  // Reading an already-created SDK identifier does not start measurement.
  // Keep this available after consent withdrawal so historical provider data
  // can still be included in the user's erasure request.
  return appsFlyerAdapter.getAppsFlyerUid();
}

export function getMeasurementState(): MeasurementState {
  return controller?.getState() ?? "waiting_for_consent";
}
