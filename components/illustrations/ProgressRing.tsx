import type { ReactNode } from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import Svg, { Circle } from "react-native-svg";

import { theme } from "@/constants/theme";

type ProgressRingProps = {
  /** 0–100. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** SVG circular progress ring (replaces the clip/rotate health-ring hack). */
export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 12,
  color = theme.colors.leaf,
  trackColor = theme.colors.leafMuted,
  children,
  style
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - clamped / 100);
  const center = size / 2;

  return (
    <View
      style={[
        { alignItems: "center", height: size, justifyContent: "center", width: size },
        style
      ]}
    >
      <Svg height={size} style={StyleSheet.absoluteFill} width={size}>
        <Circle
          cx={center}
          cy={center}
          fill="none"
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={center}
          cy={center}
          fill="none"
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center"
  }
});
