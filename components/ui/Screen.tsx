import type { PropsWithChildren, ReactNode } from "react";
import {
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  /** Apply standard horizontal padding to the content. */
  padded?: boolean;
  /** Pad the top for the status bar (skip when a full-bleed header handles it). */
  topInset?: boolean;
  /** Extra bottom space, e.g. to clear a floating action bar inside the scroll. */
  extraBottomInset?: number;
  backgroundColor?: string;
  /** Fixed element above the scroll area (e.g. a header bar). */
  header?: ReactNode;
  /** Pinned element below the scroll area (e.g. an action bar). Always visible. */
  footer?: ReactNode;
  refreshControl?: ScrollViewProps["refreshControl"];
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}>;

/**
 * Standard screen scaffold: paper background, safe-area aware top/bottom
 * padding, and an optional pinned footer. Rendering the footer outside the
 * ScrollView keeps it visible and stops action bars from overlapping content.
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  topInset = true,
  extraBottomInset = 0,
  backgroundColor = theme.colors.paper,
  header,
  footer,
  refreshControl,
  contentContainerStyle,
  style
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const paddingTop = header
    ? theme.spacing.lg
    : topInset
      ? insets.top + theme.spacing.md
      : theme.spacing.lg;
  const paddingBottom = insets.bottom + theme.spacing.xxl + extraBottomInset;
  const paddingHorizontal = padded ? theme.spacing.xl : 0;

  return (
    <View style={[{ backgroundColor, flex: 1 }, style]}>
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            { paddingBottom, paddingHorizontal, paddingTop },
            contentContainerStyle
          ]}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            { flex: 1, paddingBottom, paddingHorizontal, paddingTop },
            contentContainerStyle
          ]}
        >
          {children}
        </View>
      )}
      {footer}
    </View>
  );
}
