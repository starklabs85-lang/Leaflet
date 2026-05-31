import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";

import { theme } from "@/constants/theme";

type IconChipProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Container size in px (square). */
  size?: number;
  iconSize?: number;
  color?: string;
  background?: string;
  style?: StyleProp<ViewStyle>;
};

/** The rounded icon container reused on nearly every screen. */
export function IconChip({
  icon,
  size = 48,
  iconSize,
  color = theme.colors.forest,
  background = theme.colors.leafMuted,
  style
}: IconChipProps) {
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: background,
          borderRadius: Math.round(size * 0.32),
          height: size,
          width: size
        },
        style
      ]}
    >
      <MaterialCommunityIcons
        color={color}
        name={icon}
        size={iconSize ?? Math.round(size * 0.5)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    justifyContent: "center"
  }
});
