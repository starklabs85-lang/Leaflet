import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { PressableScale } from "@/components/ui/PressableScale";
import { theme } from "@/constants/theme";
import type { LightExposure, PlantPlacement } from "@/types/plantCollection";

const PLACEMENT_OPTIONS: {
  value: PlantPlacement;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  { value: "indoor", label: "Indoor", icon: "home-variant-outline" },
  { value: "outdoor", label: "Outdoor", icon: "tree-outline" },
  { value: "balcony", label: "Balcony", icon: "balcony" },
  { value: "unknown", label: "Not sure", icon: "help-circle-outline" }
];

const LIGHT_OPTIONS: {
  value: LightExposure;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  { value: "low", label: "Low light", icon: "weather-night" },
  { value: "medium", label: "Medium", icon: "weather-partly-cloudy" },
  { value: "bright", label: "Bright", icon: "weather-sunny" },
  { value: "unknown", label: "Not sure", icon: "help-circle-outline" }
];

export function PlantEnvironmentFields({
  placement,
  lightExposure,
  onChangePlacement,
  onChangeLightExposure
}: {
  placement: PlantPlacement;
  lightExposure: LightExposure;
  onChangePlacement: (value: PlantPlacement) => void;
  onChangeLightExposure: (value: LightExposure) => void;
}) {
  return (
    <View>
      <Text style={styles.label}>Placement</Text>
      <Text style={styles.hint}>
        Where this plant lives — weather tips use this.
      </Text>
      <View style={styles.chips}>
        {PLACEMENT_OPTIONS.map((option) => (
          <OptionChip
            accessibilityLabel={`Set plant placement to ${option.label}`}
            icon={option.icon}
            key={option.value}
            label={option.label}
            onPress={() => onChangePlacement(option.value)}
            selected={placement === option.value}
          />
        ))}
      </View>

      <Text style={styles.label}>Light</Text>
      <Text style={styles.hint}>
        How much light its spot gets during the day.
      </Text>
      <View style={styles.chips}>
        {LIGHT_OPTIONS.map((option) => (
          <OptionChip
            accessibilityLabel={`Set light exposure to ${option.label}`}
            icon={option.icon}
            key={option.value}
            label={option.label}
            onPress={() => onChangeLightExposure(option.value)}
            selected={lightExposure === option.value}
          />
        ))}
      </View>
    </View>
  );
}

function OptionChip({
  accessibilityLabel,
  icon,
  label,
  onPress,
  selected
}: {
  accessibilityLabel: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : null]}
    >
      <MaterialCommunityIcons
        color={selected ? theme.colors.white : theme.colors.forest}
        name={icon}
        size={16}
      />
      <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  label: {
    ...theme.text.label,
    fontSize: theme.typography.body,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.xl
  },
  hint: {
    ...theme.text.caption,
    marginBottom: theme.spacing.md,
    marginTop: -theme.spacing.xs
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  chip: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  chipSelected: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest
  },
  chipText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.caption
  },
  chipTextSelected: {
    color: theme.colors.white
  }
});
