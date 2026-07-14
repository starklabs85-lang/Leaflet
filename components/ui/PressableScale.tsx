import * as Haptics from "expo-haptics";
import { useRef } from "react";
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle
} from "react-native";

import {
  trackTap,
  type AnalyticsParams,
  type AnalyticsTapName
} from "@/lib/analytics/firebaseAnalytics";

export type PressableAnalytics = {
  params?: AnalyticsParams | (() => AnalyticsParams);
  tapName: AnalyticsTapName;
};

export type PressableScaleProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  analytics?: PressableAnalytics;
  /** Style applied to the animated wrapper (e.g. margins, alignSelf). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Scale value at the bottom of the press. */
  scaleTo?: number;
  /** Fire a haptic tap on press. Defaults to true. */
  haptic?: boolean;
  hapticStyle?: Haptics.ImpactFeedbackStyle;
};

/**
 * A Pressable that scales in on touch and fires a light haptic on press.
 * Used for every tappable card/button so feedback is consistent across the app.
 * Built on the core Animated API — no reanimated dependency required.
 */
export function PressableScale({
  analytics,
  style,
  containerStyle,
  scaleTo = 0.97,
  haptic = true,
  hapticStyle = Haptics.ImpactFeedbackStyle.Light,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, containerStyle]}>
      <Pressable
        {...rest}
        disabled={disabled}
        onPressIn={(event) => {
          Animated.spring(scale, {
            toValue: scaleTo,
            useNativeDriver: true,
            speed: 40,
            bounciness: 0
          }).start();
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 30,
            bounciness: 6
          }).start();
          onPressOut?.(event);
        }}
        onPress={(event) => {
          if (haptic && !disabled) {
            Haptics.impactAsync(hapticStyle).catch(() => undefined);
          }
          if (analytics && !disabled) {
            const params =
              typeof analytics.params === "function"
                ? analytics.params()
                : analytics.params;

            void trackTap(analytics.tapName, params);
          }
          onPress?.(event);
        }}
        style={style}
      />
    </Animated.View>
  );
}
