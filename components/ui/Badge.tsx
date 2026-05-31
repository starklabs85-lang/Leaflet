import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";

import { theme } from "@/constants/theme";

export type BadgeTone = "healthy" | "attention" | "sick" | "neutral" | "info";

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  healthy: { bg: theme.colors.leafMuted, fg: theme.colors.leaf },
  attention: { bg: theme.colors.honey, fg: theme.colors.ochre },
  sick: { bg: theme.colors.blush, fg: theme.colors.terra },
  neutral: { bg: theme.colors.leafMuted, fg: theme.colors.moss },
  info: { bg: theme.colors.mist, fg: theme.colors.forest }
};

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Status pill — replaces bare colored dots for health/care states. */
export function Badge({
  label,
  tone = "neutral",
  icon,
  dot = false,
  style
}: BadgeProps) {
  const palette = TONES[tone];

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: palette.fg }]} /> : null}
      {icon ? (
        <MaterialCommunityIcons color={palette.fg} name={icon} size={13} />
      ) : null}
      <Text numberOfLines={1} style={[styles.label, { color: palette.fg }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 5
  },
  dot: {
    borderRadius: 4,
    height: 8,
    width: 8
  },
  label: {
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 12,
    lineHeight: 16
  }
});
