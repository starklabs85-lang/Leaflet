import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { StyleSheet, Text, View } from "react-native";
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
import { useCareReminderNotificationRouting } from "@/lib/notifications/careReminders";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { ConnectivityProvider } from "@/providers/ConnectivityProvider";
import { OnboardingProvider, useOnboarding } from "@/providers/OnboardingProvider";

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
    return <LoadingScreen message="Loading Leaflet..." />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <OnboardingProvider>
          <ConnectivityProvider>
            <AuthGate />
          </ConnectivityProvider>
        </OnboardingProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AuthGate() {
  const auth = useAuth();
  const onboarding = useOnboarding();
  const router = useRouter();
  const segments = useSegments();
  const routeSegments = segments as string[];
  useCareReminderNotificationRouting(auth.status === "authenticated");

  useEffect(() => {
    if (auth.status === "loading" || onboarding.isLoading) {
      return;
    }

    const isPublicRoute = routeSegments[0] === "(public)";
    const isPublicLegalRoute = isPublicRoute && routeSegments[1] === "legal";
    const isAuthenticated = auth.status === "authenticated";
    const isAuthOnboardingRoute =
      routeSegments[0] === "(auth)" && routeSegments[1] === "onboarding";
    const isFirstPlantLoopRoute =
      routeSegments[0] === "(auth)" &&
      ((routeSegments[1] === "(tabs)" && routeSegments[2] === "scan") ||
        (routeSegments[1] === "plants" && routeSegments[2] === "save") ||
        routeSegments[1] === "species");

    if (!isAuthenticated && !isPublicRoute) {
      router.replace(
        (onboarding.status === "needs_onboarding"
          ? "/(public)/onboarding/welcome"
          : "/(public)/sign-in") as never
      );
      return;
    }

    if (isAuthenticated && onboarding.status === "needs_onboarding") {
      if (isPublicRoute || (!isAuthOnboardingRoute && !isFirstPlantLoopRoute)) {
        router.replace("/(auth)/onboarding/first-scan" as never);
      }
      return;
    }

    if (isAuthenticated && isPublicRoute && !isPublicLegalRoute) {
      router.replace("/(auth)/(tabs)/home");
    }
  }, [auth.status, onboarding.isLoading, onboarding.status, router, segments]);

  if (auth.status === "loading" || onboarding.isLoading) {
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

function LoadingScreen({ message }: { message: string }) {
  return (
    <View style={styles.loadingScreen}>
      <Text style={styles.loadingEyebrow}>Leaflet</Text>
      <Text style={styles.loadingText}>{message}</Text>
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
  }
});
