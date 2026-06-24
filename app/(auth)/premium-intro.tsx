import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

import { Confetti } from "@/components/illustrations/Confetti";
import { PremiumContent } from "@/components/payments/PremiumContent";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { theme } from "@/constants/theme";

/**
 * One-time trial introduction, shown after the first meaningful Premium
 * moment. "Continue with free" keeps the user in the locked app shell.
 */
export default function PremiumIntroScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    next?: string | string[];
    plantId?: string | string[];
    plantName?: string | string[];
  }>();
  const next = getParam(params.next);
  const plantId = getParam(params.plantId);
  const plantName = getParam(params.plantName);

  function continueOnward() {
    if (next === "activation") {
      router.replace("/(auth)/onboarding/activation" as never);
      return;
    }

    if (plantId) {
      router.replace({
        pathname: "/(auth)/plants/[plantId]" as never,
        params: { plantId }
      });
      return;
    }

    router.replace("/(auth)/(tabs)/home");
  }

  return (
    <Screen
      footer={
        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + theme.spacing.md }
          ]}
        >
          <Button
            accessibilityLabel="Continue without Premium"
            label="Continue without Premium"
            onPress={continueOnward}
            variant="secondary"
          />
        </View>
      }
    >
      <View style={styles.celebration}>
        <Confetti height={96} width={220} />
      </View>
      <Text style={styles.eyebrow}>First plant saved</Text>
      <Text style={styles.title}>
        {plantName ? `${plantName} is in! 🌿` : "Your first plant is in! 🌿"}
      </Text>
      <Text style={styles.subtitle}>
        Premium unlocks saved plants, diagnosis, care info, reminders, weather
        tips, and growth photos.
      </Text>

      <PremiumContent onPurchased={continueOnward} />
    </Screen>
  );
}

function getParam(value: string | string[] | undefined) {
  const param = Array.isArray(value) ? value[0] : value;

  return param?.trim() ? param : null;
}

const styles = StyleSheet.create({
  celebration: {
    alignItems: "center",
    marginTop: theme.spacing.lg
  },
  eyebrow: {
    ...theme.text.eyebrow,
    marginTop: theme.spacing.lg,
    textAlign: "center"
  },
  title: {
    ...theme.text.display,
    marginTop: theme.spacing.sm,
    textAlign: "center"
  },
  subtitle: {
    ...theme.text.body,
    color: theme.colors.moss,
    marginBottom: theme.spacing.xl,
    marginTop: theme.spacing.md,
    textAlign: "center"
  },
  footer: {
    backgroundColor: theme.colors.paper,
    borderTopColor: theme.colors.line,
    borderTopWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md
  }
});
