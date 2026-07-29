import { clearAnalyticsUser } from "@/lib/analytics/firebaseAnalytics";
import { resetWeatherTipsCache } from "@/lib/api/weatherTips";
import { signOutOfNativeProviders } from "@/lib/auth";
import { resetStreakMilestones } from "@/lib/careStreakMilestones";
import { env, hasSupabaseConfig } from "@/lib/env";
import { resetStoredUserLocation } from "@/lib/location/userLocation";
import { clearPendingDeepLink } from "@/lib/deepLinks/pendingOneLink";
import { runLocalResetSteps } from "@/lib/localResetFlow";
import { resetCareReminderState } from "@/lib/notifications/careReminders";
import { resetWeatherAlertState } from "@/lib/notifications/weatherAlerts";
import { logOutPurchases } from "@/lib/payments/revenuecat";
import { resetTrialIntroState } from "@/lib/payments/trialIntro";
import { secureStorageAdapter } from "@/lib/secure-storage";
import { resetSupabaseSession } from "@/lib/supabaseSessionReset";
import { disposeSupabaseClient, getSupabaseClient } from "@/lib/supabase";
import { resetOnboardingStorage } from "@/providers/OnboardingProvider";

export type AppResetReason = "account_deleted" | "reinstall";

function getSupabaseAuthStorageKeys() {
  if (!hasSupabaseConfig()) {
    return [];
  }

  const projectRef = new URL(env.supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  return [storageKey, `${storageKey}-code-verifier`, `${storageKey}-user`];
}

async function clearSupabaseSession() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession().catch(() => ({
    data: { session: null }
  }));
  const userId = data.session?.user.id ?? null;

  await resetSupabaseSession({
    signOut: () => supabase.auth.signOut({ scope: "local" }),
    removePersistedSession: () =>
      Promise.all(
        getSupabaseAuthStorageKeys().map((key) =>
          secureStorageAdapter.removeItem(key)
        )
      ),
    disposeClient: async () => disposeSupabaseClient()
  });

  return userId;
}

export async function resetLocalAppState({
  userId
}: {
  reason: AppResetReason;
  userId?: string | null;
}) {
  let resolvedUserId = userId ?? null;

  await runLocalResetSteps({
    essential: [
      async () => {
        resolvedUserId = resolvedUserId ?? (await clearSupabaseSession());
      },
      resetOnboardingStorage
    ],
    cleanup: [
      signOutOfNativeProviders,
      logOutPurchases,
      clearAnalyticsUser,
      resetCareReminderState,
      resetWeatherAlertState,
      resetStoredUserLocation,
      resetWeatherTipsCache,
      resetTrialIntroState,
      clearPendingDeepLink,
      () => resetStreakMilestones(resolvedUserId)
    ]
  });
}
