import Svg, { Path } from "react-native-svg";

import { theme } from "@/constants/theme";

type SparkleProps = {
  size?: number;
  color?: string;
};

/** Four-point sparkle accent for celebrations. */
export function Sparkle({ size = 24, color = theme.colors.honey }: SparkleProps) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Path
        d="M12 0 C13 7 17 11 24 12 C17 13 13 17 12 24 C11 17 7 13 0 12 C7 11 11 7 12 0 Z"
        fill={color}
      />
    </Svg>
  );
}
