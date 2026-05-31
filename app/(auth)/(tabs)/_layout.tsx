import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function tabIcon(active: IconName, inactive: IconName) {
  return ({ color, focused, size }: { color: string; focused: boolean; size: number }) => (
    <MaterialCommunityIcons
      color={color}
      name={focused ? active : inactive}
      size={size ?? 24}
    />
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.forest,
        tabBarInactiveTintColor: theme.colors.moss,
        tabBarLabelStyle: {
          fontFamily: theme.typography.fontFamily.bodyBold,
          fontSize: 11
        },
        tabBarItemStyle: {
          paddingTop: theme.spacing.xs
        },
        tabBarStyle: {
          backgroundColor: theme.colors.white,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
          borderTopWidth: 0,
          elevation: 14,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + theme.spacing.xs,
          paddingTop: theme.spacing.sm,
          shadowColor: "#15271B",
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.08,
          shadowRadius: 16
        }
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarAccessibilityLabel: "Home tab",
          tabBarIcon: tabIcon("home-variant", "home-variant-outline")
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarAccessibilityLabel: "Scan tab",
          tabBarIcon: tabIcon("line-scan", "line-scan")
        }}
      />
      <Tabs.Screen
        name="plants"
        options={{
          title: "My Plants",
          tabBarAccessibilityLabel: "My Plants tab",
          tabBarIcon: tabIcon("sprout", "sprout-outline")
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarAccessibilityLabel: "Profile tab",
          tabBarIcon: tabIcon("account-circle", "account-circle-outline")
        }}
      />
    </Tabs>
  );
}
