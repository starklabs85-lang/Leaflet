import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

import { theme } from "@/constants/theme";

type ScanFrameProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  cornerLength?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Camera viewfinder corner brackets for the scan screen. */
export function ScanFrame({
  size = 240,
  color = theme.colors.white,
  strokeWidth = 5,
  cornerLength = 44,
  radius = 22,
  style
}: ScanFrameProps) {
  const m = strokeWidth / 2 + 2;
  const max = size - m;
  const len = cornerLength;
  const r = radius;

  const corners = [
    // Top-left
    `M${m} ${m + len} L${m} ${m + r} Q${m} ${m} ${m + r} ${m} L${m + len} ${m}`,
    // Top-right
    `M${max - len} ${m} L${max - r} ${m} Q${max} ${m} ${max} ${m + r} L${max} ${m + len}`,
    // Bottom-right
    `M${max} ${max - len} L${max} ${max - r} Q${max} ${max} ${max - r} ${max} L${max - len} ${max}`,
    // Bottom-left
    `M${m + len} ${max} L${m + r} ${max} Q${m} ${max} ${m} ${max - r} L${m} ${max - len}`
  ];

  return (
    <View pointerEvents="none" style={style}>
      <Svg height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        {corners.map((d) => (
          <Path
            key={d}
            d={d}
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
          />
        ))}
      </Svg>
    </View>
  );
}
