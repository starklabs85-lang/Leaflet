import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop
} from "react-native-svg";

import { theme } from "@/constants/theme";

type LineChartProps = {
  /** Each value 0–100. */
  values: number[];
  width: number;
  height?: number;
  color?: string;
  labels?: string[];
  style?: StyleProp<ViewStyle>;
};

const PADDING = 18;

/** SVG area/line chart (replaces the rotated View-segment chart hack). */
export function LineChart({
  values,
  width,
  height = 120,
  color = theme.colors.leaf,
  labels,
  style
}: LineChartProps) {
  const plotWidth = width - PADDING * 2;
  const plotHeight = height - PADDING * 2;
  const baseline = PADDING + plotHeight;
  const count = values.length;

  const points = values.map((value, index) => {
    const clamped = Math.max(0, Math.min(100, value));
    const x =
      PADDING + (count <= 1 ? plotWidth / 2 : (index / (count - 1)) * plotWidth);
    const y = PADDING + (1 - clamped / 100) * plotHeight;
    return { x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L${points[points.length - 1].x} ${baseline} L${points[0].x} ${baseline} Z`
      : "";

  return (
    <View style={style}>
      <Svg height={height} width={width}>
        <Defs>
          <SvgLinearGradient id="leafletAreaFill" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.28} />
            <Stop offset="1" stopColor={color} stopOpacity={0.02} />
          </SvgLinearGradient>
        </Defs>

        {[PADDING, height / 2, baseline].map((y) => (
          <Line
            key={y}
            stroke={theme.colors.leafMuted}
            strokeWidth={1}
            x1={PADDING}
            x2={width - PADDING}
            y1={y}
            y2={y}
          />
        ))}

        {points.length > 0 ? (
          <>
            <Path d={areaPath} fill="url(#leafletAreaFill)" />
            <Path
              d={linePath}
              fill="none"
              stroke={color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
            />
            {points.map((point, index) => (
              <Circle
                key={index}
                cx={point.x}
                cy={point.y}
                fill={theme.colors.white}
                r={4}
                stroke={theme.colors.forest}
                strokeWidth={2}
              />
            ))}
          </>
        ) : null}
      </Svg>

      {labels && labels.length > 0 ? (
        <View style={[styles.labels, { width }]}>
          {labels.map((label, index) =>
            index === 0 || index === labels.length - 1 || index === 3 ? (
              <Text key={`${label}-${index}`} style={styles.label}>
                {label}
              </Text>
            ) : (
              <View key={`spacer-${index}`} style={styles.spacer} />
            )
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: theme.spacing.sm
  },
  label: {
    color: theme.colors.moss,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 12
  },
  spacer: {
    width: 1
  }
});
