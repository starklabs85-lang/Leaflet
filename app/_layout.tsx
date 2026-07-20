import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import {
  Fredoka_600SemiBold,
  Fredoka_700Bold
} from "@expo-google-fonts/fredoka";
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts
} from "@expo-google-fonts/nunito";

import { OfflineBanner } from "@/components/OfflineBanner";
import { theme } from "@/constants/theme";
import {
  clearAnalyticsUser,
  setAnalyticsUser
} from "@/lib/analytics/firebaseAnalytics";
import { useFirebaseScreenTracking } from "@/lib/analytics/useFirebaseScreenTracking";
import { useCareReminderNotificationRouting } from "@/lib/notifications/careReminders";
import { getCareReminderSettings } from "@/lib/notifications/careReminders";
import { getStoredUserLocation } from "@/lib/location/userLocation";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import {
  AppInstallationProvider,
  useAppInstallation
} from "@/providers/AppInstallationProvider";
import { ConnectivityProvider } from "@/providers/ConnectivityProvider";
import {
  EntitlementProvider,
  useEntitlement
} from "@/providers/EntitlementProvider";
import { OnboardingProvider, useOnboarding } from "@/providers/OnboardingProvider";
import { PendingScanProvider } from "@/providers/PendingScanProvider";

// Keep the native splash visible until the brand fonts are ready so we never
// flash system type. Errors here are non-fatal (we still fall back gracefully).
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontLoadTimedOut, setFontLoadTimedOut] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold
  });
  const canRender = fontsLoaded || Boolean(fontError) || fontLoadTimedOut;

  useEffect(() => {
    if (fontsLoaded || fontError) {
      return undefined;
    }

    const timeout = setTimeout(() => setFontLoadTimedOut(true), 3000);

    return () => clearTimeout(timeout);
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (canRender) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [canRender]);

  // Hold briefly for brand fonts, then render with system fallback instead of
  // leaving users on a blank native splash if font loading stalls.
  if (!canRender) {
    return <LoadingScreen message="Loading Fernly..." />;
  }

  return (
    <SafeAreaProvider>
      <AppInstallationProvider>
        <InstallationGate />
      </AppInstallationProvider>
    </SafeAreaProvider>
  );
}

function InstallationGate() {
  const installation = useAppInstallation();

  if (installation.status !== "ready") {
    return (
      <LoadingScreen
        message={
          installation.errorMessage ??
          (installation.status === "resetting"
            ? "Resetting Fernly..."
            : "Checking this installation...")
        }
        onRetry={installation.status === "error" ? installation.retry : undefined}
      />
    );
  }

  return (
    <AuthProvider key={installation.generation}>
      <EntitlementProvider>
        <OnboardingProvider>
          <PendingScanProvider>
            <ConnectivityProvider>
              <AnalyticsIdentitySync />
              <AuthGate />
            </ConnectivityProvider>
          </PendingScanProvider>
        </OnboardingProvider>
      </EntitlementProvider>
    </AuthProvider>
  );
}

function AnalyticsIdentitySync() {
  const { status, user } = useAuth();
  const entitlement = useEntitlement();
  const onboarding = useOnboarding();
  const authProvider = getAnalyticsAuthProvider(user);

  useEffect(() => {
    let isActive = true;

    async function syncIdentity() {
      if (status !== "authenticated" || !user?.id) {
        await clearAnalyticsUser();
        return;
      }

      const [reminderSettings, weatherLocation] = await Promise.all([
        getCareReminderSettings().catch(() => null),
        getStoredUserLocation().catch(() => null)
      ]);

      if (!isActive) {
        return;
      }

      await setAnalyticsUser(user.id, {
        auth_provider: authProvider,
        care_reminders_enabled: reminderSettings?.enabled ?? null,
        onboarding_status: onboarding.status,
        premium_status: entitlement.isPremium ? "premium" : "free",
        weather_location_source: weatherLocation?.source ?? "none"
      });
    }

    void syncIdentity();

    return () => {
      isActive = false;
    };
  }, [authProvider, entitlement.isPremium, onboarding.status, status, user?.id]);

  return null;
}

function AuthGate() {
  const auth = useAuth();
  const onboarding = useOnboarding();
  const router = useRouter();
  const segments = useSegments();
  const routeSegments = segments as string[];
  const isAppLoading = auth.status === "loading" || onboarding.isLoading;
  const pendingRedirect = isAppLoading
    ? null
    : getPendingAuthRedirect(routeSegments, auth.status, onboarding.status);
  useCareReminderNotificationRouting(auth.status === "authenticated");
  useFirebaseScreenTracking({
    enabled: !isAppLoading && pendingRedirect === null,
    segments: routeSegments
  });

  useEffect(() => {
    if (!pendingRedirect) {
      return;
    }

    router.replace(pendingRedirect as never);
  }, [pendingRedirect, router]);

  if (isAppLoading) {
    return <LoadingScreen message="Restoring your session..." />;
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.paper }
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(public)" />
        <Stack.Screen name="(auth)" />
      </Stack>
      <OfflineBanner />
      <StatusBar style="dark" />
    </>
  );
}

function getAnalyticsAuthProvider(user: ReturnType<typeof useAuth>["user"]) {
  const provider =
    typeof user?.app_metadata?.provider === "string"
      ? user.app_metadata.provider
      : undefined;

  if (provider === "apple" || provider === "google") {
    return provider;
  }

  return "unknown";
}

function getPendingAuthRedirect(
  routeSegments: string[],
  authStatus: ReturnType<typeof useAuth>["status"],
  onboardingStatus: ReturnType<typeof useOnboarding>["status"]
) {
  const isPublicRoute = routeSegments[0] === "(public)";
  const isPublicLegalRoute = isPublicRoute && routeSegments[1] === "legal";
  const isPublicOnboardingRoute = isPublicRoute && routeSegments[1] === "onboarding";
  const isAuthenticated = authStatus === "authenticated";
  const isOnboardingScanRoute =
    routeSegments[0] === "(auth)" &&
    routeSegments[1] === "(tabs)" &&
    routeSegments[2] === "scan";
  const isOnboardingPremiumRoute =
    routeSegments[0] === "(auth)" && routeSegments[1] === "premium";

  if (!isAuthenticated && !isPublicRoute) {
    return onboardingStatus === "needs_onboarding"
      ? "/(public)/onboarding/welcome"
      : "/(public)/sign-in";
  }

  if (
    isAuthenticated &&
    onboardingStatus === "needs_onboarding" &&
    !isPublicOnboardingRoute &&
    !isOnboardingScanRoute &&
    !isOnboardingPremiumRoute
  ) {
    return "/(public)/onboarding/welcome";
  }

  if (isAuthenticated && isPublicRoute && !isPublicLegalRoute && !isPublicOnboardingRoute) {
    return "/(auth)/(tabs)/home";
  }

  return null;
}

function LoadingScreen({
  message,
  onRetry
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.loadingScreen}>
      <Text style={styles.loadingEyebrow}>Fernly</Text>
      <Text style={styles.loadingText}>{message}</Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed
          ]}
        >
          <Text style={styles.retryButtonText}>Try again</Text>
        </Pressable>
      ) : null}
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: "center",
    backgroundColor: theme.colors.paper,
    flex: 1,
    justifyContent: "center",
    padding: theme.spacing.xl
  },
  loadingEyebrow: {
    ...theme.text.eyebrow,
    marginBottom: theme.spacing.sm
  },
  loadingText: {
    ...theme.text.body,
    color: theme.colors.forest,
    textAlign: "center"
  },
  retryButton: {
    backgroundColor: theme.colors.forest,
    borderRadius: theme.radius.pill,
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm
  },
  retryButtonPressed: {
    opacity: 0.85
  },
  retryButtonText: {
    ...theme.text.label,
    color: theme.colors.white
  }
});
