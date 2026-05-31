import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

import { theme } from "@/constants/theme";

type EmptyPlantsProps = {
  size?: number;
};

/** Muted "empty collection" illustration: a pot with a single small sprout. */
export function EmptyPlants({ size = 160 }: EmptyPlantsProps) {
  return (
    <Svg height={size} viewBox="0 0 200 200" width={size}>
      <Circle cx={100} cy={100} fill={theme.colors.leafMuted} r={88} />

      {/* Sprout */}
      <Path
        d="M100 120 L100 78"
        fill="none"
        stroke={theme.colors.leaf}
        strokeLinecap="round"
        strokeWidth={5}
      />
      <Path
        d="M100 92 C84 92 74 80 74 66 C90 66 100 78 100 92 Z"
        fill={theme.colors.canopy}
      />
      <Path
        d="M100 100 C116 100 126 88 126 74 C110 74 100 86 100 100 Z"
        fill={theme.colors.leaf}
      />

      {/* Soil + pot */}
      <Ellipse cx={100} cy={122} fill="#6B4A30" rx={46} ry={8} />
      <Rect fill={theme.colors.blush} height={18} rx={7} width={108} x={46} y={116} />
      <Path
        d="M54 134 L146 134 L136 182 Q134 188 128 188 L72 188 Q66 188 64 182 Z"
        fill={theme.colors.terra}
        opacity={0.85}
      />
    </Svg>
  );
}
