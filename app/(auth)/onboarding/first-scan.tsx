import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { theme } from "@/constants/theme";
import { useOnboarding } from "@/providers/OnboardingProvider";

export default function FirstScanPromptScreen() {
  const onboarding = useOnboarding();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [message, setMessage] = useState<string | null>(null);

  async function openCamera() {
    setMessage(null);

    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();

      if (!permission.granted) {
        setMessage(
          "Camera access is needed for your first scan. You can enable it in device settings or scan later."
        );
        return;
      }
    }

    router.replace({
      pathname: "/(auth)/(tabs)/scan" as never,
      params: { fromOnboarding: "1" }
    });
  }

  async function scanLater() {
    await onboarding.skip();
    router.replace("/(auth)/(tabs)/home");
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Step 4 of 5</Text>
      <Text style={styles.title}>Let's scan your first plant!</Text>
      <Text style={styles.body}>
        Point your camera at a houseplant - Leaflet will identify it and build a
        care plan from the result.
      </Text>

      <View style={styles.consentBox}>
        <MaterialCommunityIcons
          color={theme.colors.forest}
          name="cloud-check-outline"
          size={22}
        />
        <Text style={styles.consentText}>
          Scan photos are sent securely to Supabase and OpenAI for cloud AI
          processing. Avoid including people, documents, or private spaces.
        </Text>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.actions}>
        <Button
          accessibilityLabel="Open camera for first plant scan"
          gradient
          icon="camera"
          label="Open camera"
          onPress={openCamera}
        />
        <Button
          accessibilityLabel="Skip first scan and go to dashboard"
          label="Scan later"
          onPress={scanLater}
          variant="ghost"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center"
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
  consentBox: {
    alignItems: "flex-start",
    backgroundColor: theme.colors.leafMuted,
    borderRadius: theme.radius.card,
    flexDirection: "row",
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
    padding: theme.spacing.lg
  },
  consentText: {
    ...theme.text.body,
    color: theme.colors.forest,
    flex: 1,
    fontSize: 14,
    lineHeight: 21
  },
  message: {
    color: theme.colors.terra,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.body,
    lineHeight: 24,
    marginTop: theme.spacing.lg
  },
  actions: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xxl
  }
});
