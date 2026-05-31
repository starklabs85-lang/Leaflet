import Svg, { Path } from "react-native-svg";

import { theme } from "@/constants/theme";

type BrandMarkProps = {
  size?: number;
  color?: string;
  veinColor?: string;
};

/** Custom monstera-style leaf logo mark. */
export function BrandMark({
  size = 64,
  color = theme.colors.forest,
  veinColor = theme.colors.canopy
}: BrandMarkProps) {
  return (
    <Svg height={size} viewBox="0 0 100 100" width={size}>
      <Path
        d="M50 6 C74 20 86 44 84 70 C83 85 72 95 50 96 C28 95 17 85 16 70 C14 44 26 20 50 6 Z"
        fill={color}
      />
      <Path
        d="M50 88 L50 22 M50 42 L33 31 M50 42 L67 31 M50 60 L31 51 M50 60 L69 51 M50 76 L36 69 M50 76 L64 69"
        fill="none"
        stroke={veinColor}
        strokeLinecap="round"
        strokeWidth={3}
      />
    </Svg>
  );
}
