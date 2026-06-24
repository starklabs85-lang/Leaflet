import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Sparkle } from "@/components/illustrations/Sparkle";
import { Button } from "@/components/ui/Button";
import { theme } from "@/constants/theme";
import { requestAndEnableCareReminders } from "@/lib/notifications/careReminders";
import { useOnboarding } from "@/providers/OnboardingProvider";
import { Screen } from "@/components/ui/Screen";

type ReminderState = "checking" | "enabled" | "unavailable";

export default function OnboardingActivationScreen() {
  const onboarding = useOnboarding();
  const [reminderState, setReminderState] = useState<ReminderState>("checking");
  const [reminderMessage, setReminderMessage] = useState<string>(
    "Preparing local care reminders."
  );
  const context = onboarding.activationContext;

  useEffect(() => {
    let mounted = true;

    requestAndEnableCareReminders().then((result) => {
      if (!mounted) {
        return;
      }

      setReminderState(result.ok ? "enabled" : "unavailable");
      setReminderMessage(
        result.ok ? "Care reminders are ready for this device." : result.message
      );
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.logoMark}>
        <LinearGradient
          colors={theme.gradient.brand}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <MaterialCommunityIcons color={theme.colors.white} name="check-bold" size={46} />
        <View style={styles.logoSparkle}>
          <Sparkle size={22} />
        </View>
      </View>

      <Text style={styles.eyebrow}>Step 5 of 5</Text>
      <Text style={styles.title}>
        You're all set{context?.plantName ? `! ${context.plantName} is saved.` : "!"}
      </Text>
      <Text style={styles.body}>{getCarePreview(context?.waterInDays ?? null)}</Text>

      <View style={styles.reminderBox}>
        {reminderState === "checking" ? (
          <ActivityIndicator color={theme.colors.forest} />
        ) : (
          <MaterialCommunityIcons
            color={
              reminderState === "enabled" ? theme.colors.leaf : theme.colors.terra
            }
            name={
              reminderState === "enabled" ? "bell-check-outline" : "bell-alert-outline"
            }
            size={24}
          />
        )}
        <Text style={styles.reminderText}>{reminderMessage}</Text>
      </View>

      <Button
        accessibilityLabel="Go to dashboard"
        gradient
        icon="arrow-right"
        iconPosition="trailing"
        label="Go to dashboard"
        onPress={() => router.replace("/(auth)/(tabs)/home")}
        style={styles.cta}
      />
    </Screen>
  );
}

function getCarePreview(waterInDays: number | null) {
  if (typeof waterInDays === "number" && waterInDays > 0) {
    return `We'll remind you to water it in ${waterInDays} ${
      waterInDays === 1 ? "day" : "days"
    }.`;
  }

  return "Your dashboard is active, and Fernly will surface care tasks as they come due.";
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center"
  },
  logoMark: {
    alignItems: "center",
    borderRadius: theme.radius.pill,
    height: 100,
    justifyContent: "center",
    marginBottom: theme.spacing.xl,
    overflow: "hidden",
    position: "relative",
    width: 100,
    ...theme.shadow.lifted
  },
  logoSparkle: {
    position: "absolute",
    right: 8,
    top: 8
  },
  eyebrow: {
    ...theme.text.eyebrow
  },
  title: {
    ...theme.text.display,
    marginTop: theme.spacing.sm
  },
  body: {
    ...theme.text.body,
    color: theme.colors.moss,
    marginTop: theme.spacing.md
  },
  reminderBox: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
    minHeight: 72,
    padding: theme.spacing.lg,
    ...theme.shadow.soft
  },
  reminderText: {
    ...theme.text.body,
    flex: 1
  },
  cta: {
    marginTop: theme.spacing.xxl
  }
});
