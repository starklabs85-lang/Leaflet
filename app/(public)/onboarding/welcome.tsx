import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandMark } from "@/components/illustrations/BrandMark";
import { LeafDecor } from "@/components/illustrations/LeafDecor";
import { PlantMascot } from "@/components/illustrations/PlantMascot";
import { Button } from "@/components/ui/Button";
import { theme } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import { useOnboarding } from "@/providers/OnboardingProvider";

export default function OnboardingWelcomeScreen() {
  const auth = useAuth();
  const onboarding = useOnboarding();
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(28)).current;
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

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

  const entrance = { opacity: fade, transform: [{ translateY: lift }] };

  async function getStarted() {
    if (isStarting) return;

    setIsStarting(true);
    setError(null);
    try {
      await auth.ensureAnonymousSession();
      await onboarding.completeFromWelcome();
      router.replace("/(auth)/(tabs)/home" as never);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Fernly could not start your private session.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <View style={styles.root}>
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
            <Text style={styles.wordmark}>Fernly</Text>
          </View>
          <Text style={styles.title}>Happy plants,{"\n"}happy you.</Text>
          <Text style={styles.body}>
            Scan any plant to identify it, learn exactly how to care for it, and
            keep every leaf thriving.
          </Text>

          <View style={styles.dots}>
            <View style={[styles.dot, styles.dotActive]} />
          </View>

          <Button
            accessibilityLabel="Get started with Fernly onboarding"
            disabled={isStarting}
            gradient
            icon="arrow-right"
            iconPosition="trailing"
            label={isStarting ? "Preparing your dashboard..." : "Get started"}
            loading={isStarting}
            onPress={getStarted}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
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
  },
  error: {
    ...theme.text.caption,
    color: theme.colors.terra,
    marginTop: theme.spacing.md
  }
});
