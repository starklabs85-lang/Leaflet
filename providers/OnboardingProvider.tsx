import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { secureStorageAdapter } from "@/lib/secure-storage";
import {
  ANALYTICS_EVENTS,
  trackAction
} from "@/lib/analytics/firebaseAnalytics";
import { normalizeDisplayName } from "@/lib/onboarding/flow";

export type OnboardingIntent = "new_plant_parent" | "growing_collector";

export type OnboardingActivationContext = {
  completedAt: string;
  plantId: string;
  plantName: string;
  waterInDays: number | null;
};

export type OnboardingStatus = "loading" | "needs_onboarding" | "skipped" | "complete";

type OnboardingContextValue = {
  activationContext: OnboardingActivationContext | null;
  completeWithDisplayName: (displayName: string) => Promise<void>;
  completeAfterFreeScan: () => Promise<void>;
  completeAfterPlantSave: (
    context: Omit<OnboardingActivationContext, "completedAt">
  ) => Promise<boolean>;
  intent: OnboardingIntent | null;
  displayName: string | null;
  isComplete: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
  setIntent: (intent: OnboardingIntent) => Promise<void>;
  skip: () => Promise<void>;
  status: OnboardingStatus;
};

const ONBOARDING_COMPLETE_KEY = "onboarding_complete";
// SecureStore rejects ":" in keys, so namespaces use "." (alphanumeric, ".", "-", "_" only).
const ONBOARDING_SKIPPED_KEY = "leaflet.onboarding_skipped";
const ONBOARDING_INTENT_KEY = "leaflet.onboarding_intent";
const ONBOARDING_ACTIVATION_KEY = "leaflet.onboarding_activation";
const ONBOARDING_DISPLAY_NAME_KEY = "leaflet.onboarding_display_name";

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<OnboardingStatus>("loading");
  const [intent, setStoredIntent] = useState<OnboardingIntent | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [activationContext, setActivationContext] =
    useState<OnboardingActivationContext | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");

    try {
      const [complete, skipped, storedIntent, activation, storedDisplayName] = await Promise.all([
        secureStorageAdapter.getItem(ONBOARDING_COMPLETE_KEY),
        secureStorageAdapter.getItem(ONBOARDING_SKIPPED_KEY),
        secureStorageAdapter.getItem(ONBOARDING_INTENT_KEY),
        secureStorageAdapter.getItem(ONBOARDING_ACTIVATION_KEY),
        secureStorageAdapter.getItem(ONBOARDING_DISPLAY_NAME_KEY)
      ]);

      setStoredIntent(isOnboardingIntent(storedIntent) ? storedIntent : null);
      setActivationContext(parseActivationContext(activation));
      setDisplayName(normalizeDisplayName(storedDisplayName ?? ""));

      if (complete === "true") {
        setStatus("complete");
      } else if (skipped === "true") {
        setStatus("skipped");
      } else {
        setStatus("needs_onboarding");
      }
    } catch {
      setStatus("needs_onboarding");
      setStoredIntent(null);
      setDisplayName(null);
      setActivationContext(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setIntent = useCallback(async (nextIntent: OnboardingIntent) => {
    setStoredIntent(nextIntent);
    await secureStorageAdapter.setItem(ONBOARDING_INTENT_KEY, nextIntent);
    void trackAction(ANALYTICS_EVENTS.ONBOARDING_INTENT_SELECT, {
      intent: nextIntent
    });
  }, []);

  const completeWithDisplayName = useCallback(async (value: string) => {
    const normalized = normalizeDisplayName(value);

    if (!normalized) {
      throw new Error("Enter a name between 2 and 80 characters.");
    }

    await Promise.all([
      secureStorageAdapter.setItem(ONBOARDING_DISPLAY_NAME_KEY, normalized),
      secureStorageAdapter.setItem(ONBOARDING_COMPLETE_KEY, "true"),
      secureStorageAdapter.removeItem(ONBOARDING_SKIPPED_KEY),
      secureStorageAdapter.removeItem(ONBOARDING_ACTIVATION_KEY)
    ]);
    setDisplayName(normalized);
    setActivationContext(null);
    setStatus("complete");
    void trackAction(ANALYTICS_EVENTS.ONBOARDING_COMPLETE, {
      method: "display_name"
    });
  }, []);

  const skip = useCallback(async () => {
    await secureStorageAdapter.setItem(ONBOARDING_SKIPPED_KEY, "true");
    setStatus("skipped");
    void trackAction(ANALYTICS_EVENTS.ONBOARDING_SKIP);
  }, []);

  const completeAfterPlantSave = useCallback(
    async (context: Omit<OnboardingActivationContext, "completedAt">) => {
      const wasComplete =
        status === "complete" ||
        (await secureStorageAdapter.getItem(ONBOARDING_COMPLETE_KEY)) === "true";
      const nextContext: OnboardingActivationContext = {
        ...context,
        completedAt: new Date().toISOString()
      };

      await Promise.all([
        secureStorageAdapter.setItem(ONBOARDING_COMPLETE_KEY, "true"),
        secureStorageAdapter.removeItem(ONBOARDING_SKIPPED_KEY),
        secureStorageAdapter.setItem(
          ONBOARDING_ACTIVATION_KEY,
          JSON.stringify(nextContext)
        )
      ]);

      setActivationContext(nextContext);
      setStatus("complete");
      void trackAction(ANALYTICS_EVENTS.ONBOARDING_COMPLETE, {
        method: "plant_save"
      });

      return !wasComplete;
    },
    [status]
  );

  const completeAfterFreeScan = useCallback(async () => {
    await Promise.all([
      secureStorageAdapter.setItem(ONBOARDING_COMPLETE_KEY, "true"),
      secureStorageAdapter.removeItem(ONBOARDING_SKIPPED_KEY),
      secureStorageAdapter.removeItem(ONBOARDING_ACTIVATION_KEY)
    ]);

    setActivationContext(null);
    setStatus("complete");
    void trackAction(ANALYTICS_EVENTS.ONBOARDING_COMPLETE, {
      method: "free_scan"
    });
  }, []);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      activationContext,
      completeWithDisplayName,
      completeAfterFreeScan,
      completeAfterPlantSave,
      intent,
      displayName,
      isComplete: status === "complete",
      isLoading: status === "loading",
      refresh,
      setIntent,
      skip,
      status
    }),
    [
      activationContext,
      completeWithDisplayName,
      completeAfterFreeScan,
      completeAfterPlantSave,
      intent,
      displayName,
      refresh,
      setIntent,
      skip,
      status
    ]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);

  if (!context) {
    throw new Error("useOnboarding must be used inside OnboardingProvider.");
  }

  return context;
}

function isOnboardingIntent(value: string | null): value is OnboardingIntent {
  return value === "new_plant_parent" || value === "growing_collector";
}

function parseActivationContext(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<OnboardingActivationContext>;

    if (
      typeof parsed.completedAt === "string" &&
      typeof parsed.plantId === "string" &&
      typeof parsed.plantName === "string" &&
      (typeof parsed.waterInDays === "number" || parsed.waterInDays === null)
    ) {
      return parsed as OnboardingActivationContext;
    }
  } catch {
    return null;
  }

  return null;
}
