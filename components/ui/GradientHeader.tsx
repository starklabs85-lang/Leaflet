import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren } from "react";
import {
  StyleSheet,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LeafDecor } from "@/components/illustrations/LeafDecor";
import { theme } from "@/constants/theme";

type GradientHeaderProps = PropsWithChildren<{
  colors?: readonly [ColorValue, ColorValue, ...ColorValue[]];
  style?: StyleProp<ViewStyle>;
  /** Render decorative leaf shapes in the corner. */
  decor?: boolean;
  /** Round the bottom corners (header band look). */
  rounded?: boolean;
  /** Pad for the status bar / notch. Disable when nested below another bar. */
  safeTop?: boolean;
}>;

/** Brand-gradient header band with decorative leaves. */
export function GradientHeader({
  children,
  colors = theme.gradient.brand,
  style,
  decor = true,
  rounded = true,
  safeTop = true
}: GradientHeaderProps) {
  const insets = useSafeAreaInsets();
  const paddingTop = (safeTop ? insets.top : 0) + theme.spacing.lg;

  return (
    <LinearGradient
      colors={colors}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[styles.header, rounded ? styles.rounded : null, { paddingTop }, style]}
    >
      {decor ? <LeafDecor style={styles.decor} /> : null}
      <View style={styles.content}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    overflow: "hidden",
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl
  },
  rounded: {
    borderBottomLeftRadius: theme.radius.xl,
    borderBottomRightRadius: theme.radius.xl
  },
  decor: {
    position: "absolute",
    right: -24,
    top: -20
  },
  content: {
    position: "relative"
  }
});
