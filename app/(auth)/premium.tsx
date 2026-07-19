import { StyleSheet, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { PremiumContent } from "@/components/payments/PremiumContent";
import { PressableScale } from "@/components/ui/PressableScale";
import { Screen } from "@/components/ui/Screen";
import { theme } from "@/constants/theme";
import { PREMIUM_PAYWALL_DESCRIPTION } from "@/lib/payments/paywallCopy";
import { usePendingScan } from "@/providers/PendingScanProvider";

/**
 * The premium/upgrade screen. A captured photo stays in memory while purchase
 * or restore completes, then resumes automatically once server entitlement is ready.
 */
export default function PremiumScreen() {
  const params = useLocalSearchParams<{ source?: string | string[] }>();
  const pendingScan = usePendingScan();
  const source = Array.isArray(params.source) ? params.source[0] : params.source;

  function continueAfterPurchase() {
    if (source === "captured_photo" && pendingScan.photo) {
      router.replace({
        pathname: "/(auth)/(tabs)/scan" as never,
        params: { resumePending: "1" }
      });
      return;
    }

    router.replace("/(auth)/(tabs)/home" as never);
  }

  return (
    <Screen>
      <PressableScale
        accessibilityLabel="Go back"
        accessibilityRole="button"
        haptic={false}
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <MaterialCommunityIcons
          color={theme.colors.forest}
          name="chevron-left"
          size={24}
        />
        <Text style={styles.backText}>Back</Text>
      </PressableScale>

      <Text style={styles.eyebrow}>Fernly Premium</Text>
      <Text style={styles.title}>Grow without limits</Text>
      <Text style={styles.subtitle}>{PREMIUM_PAYWALL_DESCRIPTION}</Text>

      <PremiumContent onPurchased={continueAfterPurchase} source={source ?? "premium_screen"} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    minHeight: 44
  },
  backText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.body
  },
  eyebrow: {
    ...theme.text.eyebrow,
    marginTop: theme.spacing.lg
  },
  title: {
    ...theme.text.display,
    marginTop: theme.spacing.sm
  },
  subtitle: {
    ...theme.text.body,
    color: theme.colors.moss,
    marginBottom: theme.spacing.xl,
    marginTop: theme.spacing.sm
  }
});
