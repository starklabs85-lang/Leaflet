import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { IconChip } from "@/components/ui/IconChip";
import { Screen } from "@/components/ui/Screen";
import { theme } from "@/constants/theme";
import {
  ANALYTICS_EVENTS,
  trackAction
} from "@/lib/analytics/firebaseAnalytics";

type PremiumLockedScreenProps = {
  title: string;
  message: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  analyticsSource?: string;
};

export function PremiumLockedScreen({
  title,
  message,
  icon = "lock-outline",
  secondaryLabel = "Scan a plant",
  onSecondaryPress = () => router.push("/(auth)/(tabs)/scan" as never),
  analyticsSource = "premium_locked"
}: PremiumLockedScreenProps) {
  function openPremium() {
    void trackAction(ANALYTICS_EVENTS.PREMIUM_CTA, {
      source: analyticsSource
    });
    router.push("/(auth)/premium" as never);
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <IconChip icon={icon} size={72} />
      <Text style={styles.eyebrow}>Fernly Premium</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.actions}>
        <Button
          accessibilityLabel="See Fernly Premium"
          gradient
          icon="arrow-up-circle-outline"
          label="Upgrade to Premium"
          onPress={openPremium}
        />
        <Button
          accessibilityLabel={secondaryLabel}
          icon="line-scan"
          label={secondaryLabel}
          onPress={onSecondaryPress}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center"
  },
  eyebrow: {
    ...theme.text.eyebrow,
    marginTop: theme.spacing.lg,
    textAlign: "center"
  },
  title: {
    ...theme.text.title,
    marginTop: theme.spacing.sm,
    textAlign: "center"
  },
  message: {
    ...theme.text.body,
    color: theme.colors.moss,
    marginTop: theme.spacing.md,
    textAlign: "center"
  },
  actions: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
    width: "100%"
  }
});
