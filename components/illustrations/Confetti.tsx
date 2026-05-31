import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, G, Rect } from "react-native-svg";

import { theme } from "@/constants/theme";

type ConfettiProps = {
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

type Piece = {
  x: number;
  y: number;
  rotate: number;
  color: string;
  shape: "rect" | "circle";
};

const PIECES: Piece[] = [
  { x: 18, y: 24, rotate: 20, color: theme.colors.canopy, shape: "rect" },
  { x: 52, y: 12, rotate: -15, color: theme.colors.honey, shape: "circle" },
  { x: 92, y: 30, rotate: 35, color: theme.colors.terra, shape: "rect" },
  { x: 128, y: 10, rotate: -25, color: theme.colors.leaf, shape: "circle" },
  { x: 168, y: 26, rotate: 12, color: theme.colors.ochre, shape: "rect" },
  { x: 200, y: 16, rotate: -30, color: theme.colors.canopy, shape: "circle" },
  { x: 8, y: 70, rotate: -18, color: theme.colors.honey, shape: "circle" },
  { x: 46, y: 84, rotate: 28, color: theme.colors.terra, shape: "rect" },
  { x: 150, y: 78, rotate: -22, color: theme.colors.honey, shape: "rect" },
  { x: 196, y: 66, rotate: 18, color: theme.colors.leaf, shape: "circle" },
  { x: 110, y: 92, rotate: 40, color: theme.colors.canopy, shape: "rect" }
];

/** Static confetti burst for milestone celebrations (fade/scale it via parent). */
export function Confetti({ width = 220, height = 110, style }: ConfettiProps) {
  return (
    <View pointerEvents="none" style={style}>
      <Svg height={height} viewBox="0 0 220 110" width={width}>
        {PIECES.map((piece, index) => (
          <G
            key={index}
            transform={`translate(${piece.x}, ${piece.y}) rotate(${piece.rotate})`}
          >
            {piece.shape === "rect" ? (
              <Rect fill={piece.color} height={10} rx={2} width={6} x={-3} y={-5} />
            ) : (
              <Circle fill={piece.color} r={4} />
            )}
          </G>
        ))}
      </Svg>
    </View>
  );
}
