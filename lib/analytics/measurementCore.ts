import type {
  AnalyticsParams,
  AnalyticsUserProperties,
  SanitizedAnalyticsParams
} from "./events";

export type MeasurementState =
  | "waiting_for_consent"
  | "started"
  | "disabled"
  | "misconfigured";

export type MeasurementConsentResult = "granted" | "denied" | "required";

export type MeasurementConsentAdapter = {
  applyConsent: () => Promise<Exclude<MeasurementConsentResult, "required">>;
  initialize: () => Promise<MeasurementConsentResult>;
};

export type MeasurementAdapter = {
  clearUser: () => Promise<void>;
  disable: () => Promise<void>;
  setUser: (
    userId: string,
    properties: AnalyticsUserProperties
  ) => Promise<void>;
  start: () => Promise<void>;
  trackAction: (
    name: string,
    params: SanitizedAnalyticsParams
  ) => Promise<void>;
  trackScreenView: (name: string) => Promise<void>;
};

type MeasurementControllerOptions = {
  appsFlyer: MeasurementAdapter;
  consent: MeasurementConsentAdapter;
  firebase: MeasurementAdapter;
  isConfigured?: () => boolean;
  resolveAppsFlyerEventName: (
    name: string,
    params: SanitizedAnalyticsParams
  ) => string;
  sanitizeParams?: (
    name: string,
    params?: AnalyticsParams
  ) => SanitizedAnalyticsParams;
};

export function createMeasurementController({
  appsFlyer,
  consent,
  firebase,
  isConfigured = () => true,
  resolveAppsFlyerEventName,
  sanitizeParams = (_name, params) =>
    (params ?? {}) as SanitizedAnalyticsParams
}: MeasurementControllerOptions) {
  let state: MeasurementState = "waiting_for_consent";

  async function disableMeasurement() {
    await Promise.allSettled([firebase.disable(), appsFlyer.disable()]);
    state = "disabled";
    return state;
  }

  async function startMeasurement() {
    try {
      await firebase.start();
      await appsFlyer.start();
      state = "started";
    } catch {
      await disableMeasurement();
    }

    return state;
  }

  return {
    async initializeMeasurement(): Promise<MeasurementState> {
      if (!isConfigured()) {
        state = "misconfigured";
        return state;
      }

      try {
        const result = await consent.initialize();

        if (result === "required") {
          state = "waiting_for_consent";
          return state;
        }

        return result === "granted"
          ? startMeasurement()
          : disableMeasurement();
      } catch {
        return disableMeasurement();
      }
    },

    async applyMeasurementConsent(): Promise<MeasurementState> {
      if (!isConfigured()) {
        state = "misconfigured";
        return state;
      }

      try {
        const result = await consent.applyConsent();

        return result === "granted"
          ? startMeasurement()
          : disableMeasurement();
      } catch {
        return disableMeasurement();
      }
    },

    async trackAction(name: string, params?: AnalyticsParams) {
      if (state !== "started") {
        return;
      }

      const sanitizedParams = sanitizeParams(name, params);
      const appsFlyerName = resolveAppsFlyerEventName(name, sanitizedParams);

      await Promise.allSettled([
        firebase.trackAction(name, sanitizedParams),
        appsFlyer.trackAction(appsFlyerName, sanitizedParams)
      ]);
    },

    async trackScreenView(name: string) {
      if (state !== "started") {
        return;
      }

      await Promise.allSettled([
        firebase.trackScreenView(name),
        appsFlyer.trackScreenView(name)
      ]);
    },

    async setAnalyticsUser(
      userId: string,
      properties: AnalyticsUserProperties
    ) {
      if (state !== "started") {
        return;
      }

      await Promise.allSettled([
        firebase.setUser(userId, properties),
        appsFlyer.setUser(userId, properties)
      ]);
    },

    async clearAnalyticsUser() {
      await Promise.allSettled([
        firebase.clearUser(),
        appsFlyer.clearUser()
      ]);
    },

    getState() {
      return state;
    }
  };
}
