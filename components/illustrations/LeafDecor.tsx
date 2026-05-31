import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";

type LeafDecorProps = {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/** Decorative translucent leaf + blob shapes for gradient headers. */
export function LeafDecor({
  size = 170,
  color = "#FFFFFF",
  style
}: LeafDecorProps) {
  return (
    <View pointerEvents="none" style={style}>
      <Svg height={size} viewBox="0 0 170 170" width={size}>
        <Circle cx={132} cy={36} fill={color} opacity={0.08} r={64} />
        <Circle cx={70} cy={18} fill={color} opacity={0.06} r={30} />
        <G transform="translate(98,74) rotate(35)">
          <Path
            d="M0 46 C0 21 21 0 46 0 C46 25 25 46 0 46 Z"
            fill={color}
            opacity={0.12}
          />
        </G>
        <G transform="translate(50,96) rotate(-18)">
          <Path
            d="M0 30 C0 13 13 0 30 0 C30 17 17 30 0 30 Z"
            fill={color}
            opacity={0.09}
          />
        </G>
      </Svg>
    </View>
  );
}
