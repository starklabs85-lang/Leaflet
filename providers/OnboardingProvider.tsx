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

export type OnboardingIntent = "new_plant_parent" | "growing_collector";

export type OnboardingActivationContext = {
  completedAt: string;
  plantId: string;
  plantName: string;
  waterInDays: number | null;
};

type OnboardingStatus = "loading" | "needs_onboarding" | "skipped" | "complete";

type OnboardingContextValue = {
  activationContext: OnboardingActivationContext | null;
  completeAfterPlantSave: (
    context: Omit<OnboardingActivationContext, "completedAt">
  ) => Promise<boolean>;
  intent: OnboardingIntent | null;
  isComplete: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
  setIntent: (intent: OnboardingIntent) => Promise<void>;
  skip: () => Promise<void>;
  status: OnboardingStatus;
};

const ONBOARDING_COMPLETE_KEY = "onboarding_complete";
const ONBOARDING_SKIPPED_KEY = "leaflet:onboarding_skipped";
const ONBOARDING_INTENT_KEY = "leaflet:onboarding_intent";
const ONBOARDING_ACTIVATION_KEY = "leaflet:onboarding_activation";

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<OnboardingStatus>("loading");
  const [intent, setStoredIntent] = useState<OnboardingIntent | null>(null);
  const [activationContext, setActivationContext] =
    useState<OnboardingActivationContext | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");

    try {
      const [complete, skipped, storedIntent, activation] = await Promise.all([
        secureStorageAdapter.getItem(ONBOARDING_COMPLETE_KEY),
        secureStorageAdapter.getItem(ONBOARDING_SKIPPED_KEY),
        secureStorageAdapter.getItem(ONBOARDING_INTENT_KEY),
        secureStorageAdapter.getItem(ONBOARDING_ACTIVATION_KEY)
      ]);

      setStoredIntent(isOnboardingIntent(storedIntent) ? storedIntent : null);
      setActivationContext(parseActivationContext(activation));

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
      setActivationContext(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setIntent = useCallback(async (nextIntent: OnboardingIntent) => {
    setStoredIntent(nextIntent);
    await secureStorageAdapter.setItem(ONBOARDING_INTENT_KEY, nextIntent);
  }, []);

  const skip = useCallback(async () => {
    await secureStorageAdapter.setItem(ONBOARDING_SKIPPED_KEY, "true");
    setStatus("skipped");
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

      return !wasComplete;
    },
    [status]
  );

  const value = useMemo<OnboardingContextValue>(
    () => ({
      activationContext,
      completeAfterPlantSave,
      intent,
      isComplete: status === "complete",
      isLoading: status === "loading",
      refresh,
      setIntent,
      skip,
      status
    }),
    [
      activationContext,
      completeAfterPlantSave,
      intent,
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
