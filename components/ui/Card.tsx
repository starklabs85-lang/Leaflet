import type { PropsWithChildren } from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";

import { theme } from "@/constants/theme";

type CardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
}>;

/** White surface with the soft card radius, border, and elevation preset. */
export function Card({
  children,
  style,
  padded = true,
  elevated = true
}: CardProps) {
  return (
    <View
      style={[
        styles.card,
        elevated ? styles.elevated : null,
        padded ? styles.padded : null,
        style
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1
  },
  elevated: theme.shadow.soft,
  padded: {
    padding: theme.spacing.lg
  }
});
