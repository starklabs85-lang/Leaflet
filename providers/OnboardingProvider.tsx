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
import { getWelcomeOnboardingCompletionMethod } from "@/lib/onboarding/flow";

export type OnboardingActivationContext = {
  completedAt: string;
  plantId: string;
  plantName: string;
  waterInDays: number | null;
};

export type OnboardingStatus = "loading" | "needs_onboarding" | "skipped" | "complete";

type OnboardingContextValue = {
  activationContext: OnboardingActivationContext | null;
  completeFromWelcome: () => Promise<void>;
  completeAfterPlantSave: (
    context: Omit<OnboardingActivationContext, "completedAt">
  ) => Promise<boolean>;
  isComplete: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
  skip: () => Promise<void>;
  status: OnboardingStatus;
};

const ONBOARDING_COMPLETE_KEY = "onboarding_complete";
// SecureStore rejects ":" in keys, so namespaces use "." (alphanumeric, ".", "-", "_" only).
const ONBOARDING_SKIPPED_KEY = "leaflet.onboarding_skipped";
const ONBOARDING_ACTIVATION_KEY = "leaflet.onboarding_activation";

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<OnboardingStatus>("loading");
  const [activationContext, setActivationContext] =
    useState<OnboardingActivationContext | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");

    try {
      const [complete, skipped, activation] = await Promise.all([
        secureStorageAdapter.getItem(ONBOARDING_COMPLETE_KEY),
        secureStorageAdapter.getItem(ONBOARDING_SKIPPED_KEY),
        secureStorageAdapter.getItem(ONBOARDING_ACTIVATION_KEY)
      ]);

      await Promise.all([
        secureStorageAdapter.removeItem("leaflet.onboarding_intent"),
        secureStorageAdapter.removeItem("leaflet.onboarding_display_name")
      ]).catch(() => undefined);
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
      setActivationContext(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const completeFromWelcome = useCallback(async () => {
    await Promise.all([
      secureStorageAdapter.setItem(ONBOARDING_COMPLETE_KEY, "true"),
      secureStorageAdapter.removeItem(ONBOARDING_SKIPPED_KEY),
      secureStorageAdapter.removeItem(ONBOARDING_ACTIVATION_KEY)
    ]);
    setActivationContext(null);
    setStatus("complete");
    void trackAction(ANALYTICS_EVENTS.ONBOARDING_COMPLETE, {
      method: getWelcomeOnboardingCompletionMethod()
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

  const value = useMemo<OnboardingContextValue>(
    () => ({
      activationContext,
      completeFromWelcome,
      completeAfterPlantSave,
      isComplete: status === "complete",
      isLoading: status === "loading",
      refresh,
      skip,
      status
    }),
    [
      activationContext,
      completeFromWelcome,
      completeAfterPlantSave,
      refresh,
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
