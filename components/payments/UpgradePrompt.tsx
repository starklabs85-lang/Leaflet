import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";

import { Button } from "@/components/ui/Button";
import { theme } from "@/constants/theme";

type UpgradePromptProps = {
  title?: string;
  message: string;
  onDismiss: () => void;
  onUpgrade?: () => void;
  dismissLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Friendly, dismissible inline prompt shown when a free limit is hit.
 * Phase 12 hard rule: never a blocking popup or interstitial — "Maybe later"
 * always carries equal weight and simply continues the current screen.
 */
export function UpgradePrompt({
  title = "You've hit today's free limit",
  message,
  onDismiss,
  onUpgrade,
  dismissLabel = "Maybe later",
  style
}: UpgradePromptProps) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.titleRow}>
        <MaterialCommunityIcons
          color={theme.colors.leaf}
          name="leaf-circle-outline"
          size={24}
        />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.actions}>
        <Button
          accessibilityLabel="Dismiss upgrade suggestion"
          fullWidth={false}
          label={dismissLabel}
          onPress={onDismiss}
          style={styles.action}
          variant="secondary"
        />
        <Button
          accessibilityLabel="See Fernly Premium"
          fullWidth={false}
          gradient
          icon="arrow-up-circle-outline"
          label="Upgrade"
          onPress={onUpgrade ?? (() => router.push("/(auth)/premium" as never))}
          style={styles.action}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.honey,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    ...theme.shadow.soft
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  title: {
    ...theme.text.heading,
    flex: 1
  },
  message: {
    ...theme.text.body,
    color: theme.colors.ink
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.md
  },
  action: {
    flex: 1
  }
});
