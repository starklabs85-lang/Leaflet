import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PlaceholderScreen } from "@/components/PlaceholderScreen";
import { Button } from "@/components/ui/Button";
import { theme } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import { useOnboarding } from "@/providers/OnboardingProvider";

export default function OnboardingAccountChoiceScreen() {
  const auth = useAuth();
  const onboarding = useOnboarding();
  const [isStartingNew, setIsStartingNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continueAsNewUser() {
    if (isStartingNew) return;

    setIsStartingNew(true);
    setError(null);

    try {
      await auth.ensureAnonymousSession();
      await onboarding.completeFromWelcome();
      router.replace("/(auth)/(tabs)/home" as never);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Fernly could not prepare your dashboard. Please try again."
      );
    } finally {
      setIsStartingNew(false);
    }
  }

  const illustration = (
    <LinearGradient
      colors={theme.gradient.brand}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={styles.illustration}
    >
      <MaterialCommunityIcons
        color={theme.colors.white}
        name="account-multiple-outline"
        size={58}
      />
    </LinearGradient>
  );

  return (
    <PlaceholderScreen
      body="Choose how you'd like to continue. New plant parents can explore Fernly before creating a permanent account."
      eyebrow="Welcome to Fernly"
      illustration={illustration}
      title="Is this your first time here?"
    >
      <View style={styles.actions}>
        <Button
          accessibilityHint="Creates a private temporary session and opens your dashboard"
          gradient
          icon="sprout"
          label={isStartingNew ? "Preparing your dashboard..." : "I'm new to Fernly"}
          loading={isStartingNew}
          onPress={() => void continueAsNewUser()}
        />
        <Button
          accessibilityHint="Opens Apple and Google sign-in for an existing Fernly account"
          disabled={isStartingNew}
          icon="account-arrow-right-outline"
          label="I already have an account"
          onPress={() => router.push("/(public)/sign-in" as never)}
          variant="secondary"
        />
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </PlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: theme.spacing.md
  },
  illustration: {
    alignItems: "center",
    borderRadius: 32,
    height: 112,
    justifyContent: "center",
    width: 112,
    ...theme.shadow.lifted
  },
  error: {
    ...theme.text.caption,
    color: theme.colors.terra,
    marginTop: theme.spacing.md,
    textAlign: "center"
  }
});
