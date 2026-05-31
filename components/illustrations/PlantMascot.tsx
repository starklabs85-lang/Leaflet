import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

import { theme } from "@/constants/theme";

type PlantMascotProps = {
  size?: number;
};

/** Friendly potted-plant character for onboarding hero & empty states. */
export function PlantMascot({ size = 180 }: PlantMascotProps) {
  return (
    <Svg height={size} viewBox="0 0 200 200" width={size}>
      {/* Soft halo */}
      <Circle cx={100} cy={96} fill={theme.colors.leafMuted} r={86} />

      {/* Leaves */}
      <Path
        d="M100 116 C72 100 54 76 58 48 C86 56 104 86 100 116 Z"
        fill={theme.colors.canopy}
      />
      <Path
        d="M100 116 C128 100 146 76 142 48 C114 56 96 86 100 116 Z"
        fill={theme.colors.canopy}
      />
      <Path
        d="M100 118 C84 88 84 58 100 38 C116 58 116 88 100 118 Z"
        fill={theme.colors.leaf}
      />

      {/* Soil */}
      <Ellipse cx={100} cy={120} fill="#5A3A22" rx={50} ry={9} />

      {/* Pot */}
      <Rect fill="#A6593F" height={20} rx={8} width={120} x={40} y={112} />
      <Path
        d="M48 132 L152 132 L141 186 Q139 192 133 192 L67 192 Q61 192 59 186 Z"
        fill={theme.colors.terra}
      />

      {/* Face */}
      <Circle cx={84} cy={154} fill={theme.colors.ink} r={4.5} />
      <Circle cx={116} cy={154} fill={theme.colors.ink} r={4.5} />
      <Circle cx={74} cy={163} fill={theme.colors.blush} opacity={0.7} r={6} />
      <Circle cx={126} cy={163} fill={theme.colors.blush} opacity={0.7} r={6} />
      <Path
        d="M89 165 Q100 177 111 165"
        fill="none"
        stroke={theme.colors.ink}
        strokeLinecap="round"
        strokeWidth={4}
      />
    </Svg>
  );
}
