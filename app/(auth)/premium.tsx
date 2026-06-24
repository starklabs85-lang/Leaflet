import { StyleSheet, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";

import { PremiumContent } from "@/components/payments/PremiumContent";
import { PressableScale } from "@/components/ui/PressableScale";
import { Screen } from "@/components/ui/Screen";
import { theme } from "@/constants/theme";

/**
 * The premium/upgrade screen (Phase 13 §6). Reached only from Profile and
 * inline limit prompts — never a popup or launch interstitial.
 */
export default function PremiumScreen() {
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
      <Text style={styles.subtitle}>
        Free includes one plant identification scan per day. Premium unlocks
        diagnosis, saved plants, care info, reminders, weather tips, and growth
        photos.
      </Text>

      <PremiumContent />
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
