import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconChip } from "@/components/ui/IconChip";
import { PressableScale } from "@/components/ui/PressableScale";
import { theme } from "@/constants/theme";
import {
  type OnboardingIntent,
  useOnboarding
} from "@/providers/OnboardingProvider";

const INTENT_OPTIONS: {
  body: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  tint: string;
  value: OnboardingIntent;
}[] = [
  {
    body: "A few green friends I want to keep thriving.",
    icon: "sprout",
    label: "New plant parent",
    tint: theme.colors.leafMuted,
    value: "new_plant_parent"
  },
  {
    body: "A growing jungle I'd love to organize.",
    icon: "leaf-circle",
    label: "Growing collector",
    tint: theme.colors.mist,
    value: "growing_collector"
  }
];

export default function OnboardingIntentScreen() {
  const onboarding = useOnboarding();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<OnboardingIntent | null>(null);

  async function chooseIntent(intent: OnboardingIntent) {
    setSelected(intent);
    await onboarding.setIntent(intent);
    router.push("/(public)/onboarding/sign-in" as never);
  }

  async function skip() {
    await onboarding.skip();
    router.replace("/(public)/sign-in");
  }

  return (
    <View style={styles.root}>
      <PressableScale
        accessibilityLabel="Skip onboarding and go to sign in"
        accessibilityRole="button"
        haptic={false}
        onPress={skip}
        style={[styles.skip, { top: insets.top + theme.spacing.xs }]}
      >
        <Text style={styles.skipText}>Skip</Text>
      </PressableScale>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: insets.bottom + theme.spacing.xl,
            paddingTop: insets.top + theme.spacing.xxl
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>Quick setup</Text>
        <Text style={styles.title}>Which plant parent are you?</Text>
        <Text style={styles.body}>
          This stays on your device and helps Leaflet show the most relevant setup steps.
        </Text>

        <View style={styles.options}>
          {INTENT_OPTIONS.map((option) => {
            const isSelected = selected === option.value;

            return (
              <PressableScale
                accessibilityLabel={`${option.label}. ${option.body}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={option.value}
                onPress={() => chooseIntent(option.value)}
                style={[styles.optionCard, isSelected ? styles.optionSelected : null]}
              >
                <IconChip background={option.tint} icon={option.icon} size={56} />
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>{option.label}</Text>
                  <Text style={styles.optionBody}>{option.body}</Text>
                </View>
                <MaterialCommunityIcons
                  color={isSelected ? theme.colors.forest : theme.colors.moss}
                  name={isSelected ? "check-circle" : "chevron-right"}
                  size={24}
                />
              </PressableScale>
            );
          })}
        </View>

        <View style={styles.dots}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotActive]} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: theme.colors.paper,
    flex: 1
  },
  skip: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    position: "absolute",
    right: theme.spacing.lg,
    zIndex: 2
  },
  skipText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.body
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl
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
  options: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.xxl
  },
  optionCard: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: theme.spacing.md,
    minHeight: 96,
    padding: theme.spacing.lg,
    ...theme.shadow.soft
  },
  optionSelected: {
    backgroundColor: theme.colors.leafMuted,
    borderColor: theme.colors.forest
  },
  optionCopy: {
    flex: 1
  },
  optionTitle: {
    ...theme.text.heading
  },
  optionBody: {
    ...theme.text.caption,
    marginTop: theme.spacing.xs
  },
  dots: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xxl
  },
  dot: {
    backgroundColor: theme.colors.line,
    borderRadius: theme.radius.pill,
    height: 8,
    width: 8
  },
  dotActive: {
    backgroundColor: theme.colors.forest,
    width: 22
  }
});
