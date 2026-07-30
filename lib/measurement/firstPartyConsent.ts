import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  MeasurementConsentAdapter,
  MeasurementConsentResult
} from "@/lib/analytics/measurementCore";
import {
  measurementConsentPrompt,
  type ConsentPromptRequest,
  type MeasurementConsentChoice
} from "./consentPrompt";

const STORAGE_KEY = "fernly.measurement-consent";
const POLICY_VERSION = "2026-07-30";

type ConsentStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

type StoredConsent = {
  choice: MeasurementConsentChoice;
  policyVersion: string;
  updatedAt: string;
};

type FirstPartyConsentOptions = {
  now?: () => string;
  policyVersion?: string;
  requestChoice?: (
    request: ConsentPromptRequest
  ) => Promise<MeasurementConsentChoice>;
  storage?: ConsentStorage;
};

export type FirstPartyConsentAdapter = MeasurementConsentAdapter & {
  showPrivacyChoices: () => Promise<MeasurementConsentChoice>;
};

function parseStoredConsent(
  serialized: string | null,
  policyVersion: string
): StoredConsent | null {
  if (!serialized) {
    return null;
  }

  try {
    const value = JSON.parse(serialized) as Partial<StoredConsent>;

    return (value.choice === "granted" || value.choice === "denied") &&
      value.policyVersion === policyVersion &&
      typeof value.updatedAt === "string"
      ? (value as StoredConsent)
      : null;
  } catch {
    return null;
  }
}

export function createFirstPartyConsentAdapter({
  now = () => new Date().toISOString(),
  policyVersion = POLICY_VERSION,
  requestChoice = measurementConsentPrompt.requestChoice,
  storage = AsyncStorage
}: FirstPartyConsentOptions = {}): FirstPartyConsentAdapter {
  let shouldPrompt = false;

  async function readChoice() {
    return parseStoredConsent(
      await storage.getItem(STORAGE_KEY),
      policyVersion
    );
  }

  async function saveChoice(choice: MeasurementConsentChoice) {
    const stored: StoredConsent = {
      choice,
      policyVersion,
      updatedAt: now()
    };

    await storage.setItem(STORAGE_KEY, JSON.stringify(stored));
    shouldPrompt = false;
    return choice;
  }

  return {
    async initialize(): Promise<MeasurementConsentResult> {
      const stored = await readChoice();
      shouldPrompt = !stored;
      return stored?.choice ?? "required";
    },

    async applyConsent() {
      const stored = await readChoice();

      if (!shouldPrompt && stored) {
        return stored.choice;
      }

      return saveChoice(
        await requestChoice({
          currentChoice: null,
          mode: "initial"
        })
      );
    },

    async showPrivacyChoices() {
      const stored = await readChoice();

      return saveChoice(
        await requestChoice({
          currentChoice: stored?.choice ?? null,
          mode: "settings"
        })
      );
    }
  };
}
