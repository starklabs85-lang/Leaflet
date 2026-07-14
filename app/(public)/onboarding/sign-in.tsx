import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { SignInContent } from "@/components/auth/SignInContent";
import { theme } from "@/constants/theme";
import { useOnboarding } from "@/providers/OnboardingProvider";

export default function OnboardingSignInScreen() {
  const onboarding = useOnboarding();

  async function skipOnboarding() {
    await onboarding.skip();
    router.replace("/(public)/sign-in");
  }

  return (
    <SignInContent
      eyebrow="Step 3 of 5"
      title="Sign in to save your first plant."
      body="Fernly needs sign-in before scan results, photos, care tasks, and diagnosis history can be saved securely."
      footer={
        <Pressable
          accessibilityLabel="Skip onboarding and continue on the normal sign-in screen"
          accessibilityRole="button"
          onPress={skipOnboarding}
          style={styles.skipButton}
        >
          <Text style={styles.skipText}>Skip onboarding</Text>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  skipButton: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: theme.spacing.lg,
    minHeight: 44
  },
  skipText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.body,
    textDecorationLine: "underline"
  }
});
