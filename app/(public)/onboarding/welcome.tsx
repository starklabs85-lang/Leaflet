import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandMark } from "@/components/illustrations/BrandMark";
import { LeafDecor } from "@/components/illustrations/LeafDecor";
import { PlantMascot } from "@/components/illustrations/PlantMascot";
import { Button } from "@/components/ui/Button";
import { PressableScale } from "@/components/ui/PressableScale";
import { theme } from "@/constants/theme";
import { useOnboarding } from "@/providers/OnboardingProvider";

export default function OnboardingWelcomeScreen() {
  const onboarding = useOnboarding();
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true
      }),
      Animated.spring(lift, {
        toValue: 0,
        friction: 8,
        tension: 60,
        useNativeDriver: true
      })
    ]).start();
  }, [fade, lift]);

  async function skip() {
    await onboarding.skip();
    router.replace("/(public)/sign-in");
  }

  const entrance = { opacity: fade, transform: [{ translateY: lift }] };

  return (
    <View style={styles.root}>
      <PressableScale
        accessibilityLabel="Skip onboarding and go to sign in"
        accessibilityRole="button"
        haptic={false}
        onPress={skip}
        style={[styles.skip, { top: insets.top + theme.spacing.xs }]}
      >
        <Text style={styles.skipText}>Skip</Text>
      </PressableScale>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: insets.bottom + theme.spacing.xl,
            paddingTop: insets.top + theme.spacing.xxl
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.hero, entrance]}>
          <LinearGradient
            colors={theme.gradient.brand}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.heroCard}
          >
            <LeafDecor size={150} style={styles.heroDecor} />
            <PlantMascot size={196} />
          </LinearGradient>
        </Animated.View>

        <Animated.View style={[styles.copy, entrance]}>
          <View style={styles.brandRow}>
            <BrandMark size={24} />
            <Text style={styles.wordmark}>Leaflet</Text>
          </View>
          <Text style={styles.title}>Happy plants,{"\n"}happy you.</Text>
          <Text style={styles.body}>
            Scan any plant to identify it, learn exactly how to care for it, and
            keep every leaf thriving.
          </Text>

          <View style={styles.dots}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
          </View>

          <Button
            accessibilityLabel="Get started with Leaflet onboarding"
            gradient
            icon="arrow-right"
            iconPosition="trailing"
            label="Get started"
            onPress={() => router.push("/(public)/onboarding/intent" as never)}
          />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: theme.colors.paper,
    flex: 1
  },
  skip: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    position: "absolute",
    right: theme.spacing.lg,
    zIndex: 2
  },
  skipText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.body
  },
  content: {
    flexGrow: 1,
    gap: theme.spacing.xl,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl
  },
  hero: {
    alignItems: "center"
  },
  heroCard: {
    alignItems: "center",
    borderRadius: 32,
    justifyContent: "center",
    minHeight: 300,
    overflow: "hidden",
    paddingVertical: theme.spacing.xl,
    width: "100%"
  },
  heroDecor: {
    position: "absolute",
    right: -18,
    top: -14
  },
  copy: {
    alignItems: "flex-start"
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md
  },
  wordmark: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.displayBold,
    fontSize: 18,
    letterSpacing: 0.3
  },
  title: {
    ...theme.text.hero
  },
  body: {
    ...theme.text.body,
    color: theme.colors.moss,
    marginTop: theme.spacing.md
  },
  dots: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
    marginTop: theme.spacing.xl
  },
  dot: {
    backgroundColor: theme.colors.line,
    borderRadius: theme.radius.pill,
    height: 8,
    width: 8
  },
  dotActive: {
    backgroundColor: theme.colors.forest,
    width: 22
  }
});
