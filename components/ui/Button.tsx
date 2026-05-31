import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle
} from "react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { theme } from "@/constants/theme";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  iconPosition?: "leading" | "trailing";
  /** Fill a primary button with the brand gradient. */
  gradient?: boolean;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/**
 * Canonical button. One min-height for every CTA in the app (replaces the
 * 50/52/54 drift), with Primary / Secondary / Ghost variants and an optional
 * gradient fill + leading icon.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  iconPosition = "leading",
  gradient = false,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  accessibilityLabel,
  accessibilityHint
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const useGradient = variant === "primary" && gradient;
  const contentColor =
    variant === "primary" ? theme.colors.white : theme.colors.forest;

  return (
    <PressableScale
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      containerStyle={fullWidth ? styles.fullWidth : styles.auto}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        styles.base,
        fullWidth ? styles.fullWidth : styles.auto,
        variant === "primary" && !useGradient ? styles.primary : null,
        variant === "secondary" ? styles.secondary : null,
        variant === "ghost" ? styles.ghost : null,
        isDisabled ? styles.disabled : null,
        style
      ]}
    >
      {useGradient ? (
        <LinearGradient
          colors={theme.gradient.brand}
          end={{ x: 1, y: 1 }}
          pointerEvents="none"
          start={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <>
          {icon && iconPosition === "leading" ? (
            <MaterialCommunityIcons color={contentColor} name={icon} size={20} />
          ) : null}
          <Text numberOfLines={1} style={[styles.label, { color: contentColor }]}>
            {label}
          </Text>
          {icon && iconPosition === "trailing" ? (
            <MaterialCommunityIcons color={contentColor} name={icon} size={20} />
          ) : null}
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    minHeight: 54,
    overflow: "hidden",
    paddingHorizontal: theme.spacing.xl
  },
  fullWidth: {
    alignSelf: "stretch"
  },
  auto: {
    alignSelf: "flex-start"
  },
  primary: {
    backgroundColor: theme.colors.forest
  },
  secondary: {
    backgroundColor: theme.colors.leafMuted
  },
  ghost: {
    backgroundColor: "transparent"
  },
  disabled: {
    opacity: 0.5
  },
  label: {
    fontFamily: theme.typography.fontFamily.bodyBlack,
    fontSize: 16
  }
});
