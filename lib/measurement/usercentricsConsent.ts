import type {
  MeasurementConsentAdapter,
  MeasurementConsentResult
} from "@/lib/analytics/measurementCore";

type ConsentSummary = {
  isEssential: boolean;
  status: boolean;
};

type ReadyStatus = {
  shouldCollectConsent: boolean;
  consents: ConsentSummary[];
};

export function evaluateMeasurementConsent({
  shouldCollectConsent,
  consents
}: ReadyStatus): MeasurementConsentResult {
  if (shouldCollectConsent) {
    return "required";
  }

  const measurementConsents = consents.filter(
    (consent) => !consent.isEssential
  );

  if (measurementConsents.length === 0) {
    return "denied";
  }

  return measurementConsents.every((consent) => consent.status)
    ? "granted"
    : "denied";
}

function evaluateCollectedMeasurementConsent(consents: ConsentSummary[]) {
  return evaluateMeasurementConsent({
    shouldCollectConsent: false,
    consents
  }) === "granted"
    ? ("granted" as const)
    : ("denied" as const);
}

export type UsercentricsConsentAdapter = MeasurementConsentAdapter & {
  showPrivacyChoices: () => Promise<"granted" | "denied">;
};

export function createUsercentricsConsentAdapter(
  settingsId: string
): UsercentricsConsentAdapter {
  let configured = false;
  let shouldShowFirstLayer = false;

  async function getSdk() {
    const sdk = await import("@usercentrics/react-native-sdk");

    if (!configured) {
      sdk.Usercentrics.configure(
        new sdk.UsercentricsOptions({
          consentMediation: true,
          defaultLanguage: "en",
          initTimeoutMillis: 5000,
          settingsId
        })
      );
      configured = true;
    }

    return sdk;
  }

  return {
    async initialize() {
      if (!settingsId) {
        throw new Error("Usercentrics settings ID is missing.");
      }

      const { Usercentrics } = await getSdk();
      const status = await Usercentrics.status();
      shouldShowFirstLayer = status.shouldCollectConsent;

      return evaluateMeasurementConsent(status);
    },

    async applyConsent() {
      const { Usercentrics } = await getSdk();

      if (shouldShowFirstLayer) {
        const response = await Usercentrics.showFirstLayer();
        shouldShowFirstLayer = false;
        return evaluateCollectedMeasurementConsent(response.consents);
      }

      return evaluateCollectedMeasurementConsent(
        await Usercentrics.getConsents()
      );
    },

    async showPrivacyChoices() {
      const { Usercentrics } = await getSdk();
      const response = await Usercentrics.showSecondLayer();

      return evaluateCollectedMeasurementConsent(response.consents);
    }
  };
}
