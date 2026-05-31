import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { theme } from "@/constants/theme";
import { useConnectivity } from "@/providers/ConnectivityProvider";

export function OfflineBanner() {
  const { isOffline } = useConnectivity();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-160)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isOffline ? 0 : -160,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [isOffline, translateY]);

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents="none"
      style={[
        styles.banner,
        { paddingTop: insets.top + theme.spacing.sm, transform: [{ translateY }] }
      ]}
    >
      <MaterialCommunityIcons
        color={theme.colors.white}
        name="wifi-off"
        size={16}
      />
      <Text style={styles.text}>You're offline — some features need a connection.</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: "center",
    backgroundColor: theme.colors.ink,
    borderBottomLeftRadius: theme.radius.lg,
    borderBottomRightRadius: theme.radius.lg,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    left: 0,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 20
  },
  text: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.caption,
    lineHeight: 18,
    textAlign: "center"
  }
});
