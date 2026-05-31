import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";

import { theme } from "@/constants/theme";

type PlantImageProps = {
  uri?: string | null;
  /** Layout/size style for the container (width, height, borderRadius). */
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  fallbackIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  iconSize?: number;
  iconColor?: string;
  background?: string;
};

/**
 * Plant photo with a graceful fallback. Renders the image when a URI loads,
 * otherwise a tinted leaf placeholder — also used while a broken URL fails.
 */
export function PlantImage({
  uri,
  style,
  accessibilityLabel,
  fallbackIcon = "leaf",
  iconSize = 24,
  iconColor = theme.colors.leaf,
  background = theme.colors.leafMuted
}: PlantImageProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(uri) && !failed;
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityLabel, accessibilityRole: "image" as const }
    : {};

  return (
    <View style={[styles.container, { backgroundColor: background }, style]}>
      {showImage ? (
        <Image
          {...a11y}
          onError={() => setFailed(true)}
          source={{ uri: uri as string }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View {...a11y} style={styles.fallback}>
          <MaterialCommunityIcons
            color={iconColor}
            name={fallbackIcon}
            size={iconSize}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden"
  },
  fallback: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center"
  }
});
