import { useSyncExternalStore } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { theme } from "@/constants/theme";
import { measurementConsentPrompt } from "@/lib/measurement/consentPrompt";

export function MeasurementConsentModal() {
  const request = useSyncExternalStore(
    measurementConsentPrompt.subscribe,
    measurementConsentPrompt.getSnapshot,
    measurementConsentPrompt.getSnapshot
  );

  if (!request) {
    return null;
  }

  const isSettings = request.mode === "settings";

  return (
    <Modal
      animationType="fade"
      onRequestClose={() => undefined}
      presentationStyle="fullScreen"
      statusBarTranslucent={false}
      visible
    >
      <SafeAreaView accessibilityViewIsModal style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <MaterialCommunityIcons
                color={theme.colors.white}
                name="leaf"
                size={22}
              />
            </View>
            <Text style={styles.brand}>Fernly privacy</Text>
          </View>

          <Text style={styles.eyebrow}>
            {isSettings ? "Your saved choice" : "Before we measure"}
          </Text>
          <Text style={styles.title}>
            {isSettings
              ? "Privacy choices"
              : "Help improve Fernly—only if you choose"}
          </Text>
          <Text style={styles.intro}>
            Fernly can use optional analytics and attribution to understand
            which features help people and whether promotions lead to useful
            app activity. Fernly works normally if you decline.
          </Text>

          {isSettings ? (
            <View style={styles.currentChoice}>
              <MaterialCommunityIcons
                color={theme.colors.forest}
                name={
                  request.currentChoice === "granted"
                    ? "check-circle-outline"
                    : "minus-circle-outline"
                }
                size={20}
              />
              <Text style={styles.currentChoiceText}>
                Analytics are currently{" "}
                {request.currentChoice === "granted" ? "allowed" : "off"}.
              </Text>
            </View>
          ) : null}

          <View style={styles.cards}>
            <Card elevated={false}>
              <View style={styles.cardHeading}>
                <MaterialCommunityIcons
                  color={theme.colors.leaf}
                  name="shield-check-outline"
                  size={22}
                />
                <Text style={styles.cardTitle}>Essential app services</Text>
              </View>
              <Text style={styles.cardBody}>
                Account access, plant records, AI processing, subscriptions,
                security and account deletion continue regardless of this
                choice.
              </Text>
            </Card>

            <Card elevated={false}>
              <View style={styles.cardHeading}>
                <MaterialCommunityIcons
                  color={theme.colors.leaf}
                  name="chart-line"
                  size={22}
                />
                <Text style={styles.cardTitle}>
                  Optional analytics and attribution
                </Text>
              </View>
              <Text style={styles.cardBody}>
                If allowed, Firebase and AppsFlyer receive allowlisted screen
                views, product milestones, a pseudonymous user ID, an
                AppsFlyer installation ID, consent-permitted device signals,
                and campaign attribution data.
              </Text>
              <Text style={styles.cardBody}>
                If you accept, iOS may next ask whether Fernly can use your
                device identifier to measure ads. If you decline Apple’s
                request, AppsFlyer stays anonymous and identifier-based
                attribution, partner sharing, and subscription attribution
                stay off.
              </Text>
              <Text style={styles.cardBody}>
                Fernly never sends photos, plant names, email addresses,
                exact location, prompts, URLs, or raw errors to analytics.
              </Text>
            </Card>
          </View>

          <Text style={styles.controlCopy}>
            Events created before acceptance are discarded, not replayed. You
            can change this later in Profile → Privacy choices.
          </Text>

          <View style={styles.actions}>
            <Button
              accessibilityHint="Allows optional measurement and may show Apple's tracking permission next."
              icon="check"
              label={
                isSettings
                  ? "Allow analytics & attribution"
                  : "Continue to Apple choice"
              }
              onPress={() =>
                measurementConsentPrompt.submitChoice("granted")
              }
              variant="secondary"
            />
            <Button
              accessibilityHint="Keeps optional Firebase and AppsFlyer measurement disabled."
              icon="close"
              label={
                isSettings
                  ? "Turn analytics off"
                  : "Continue without analytics"
              }
              onPress={() => measurementConsentPrompt.submitChoice("denied")}
              variant="secondary"
            />
          </View>

          <Text style={styles.footer}>
            This choice controls measurement only. It does not affect your
            account, plant features or subscription.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.colors.paper,
    flex: 1
  },
  content: {
    alignSelf: "center",
    maxWidth: 640,
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    width: "100%"
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  brandIcon: {
    alignItems: "center",
    backgroundColor: theme.colors.forest,
    borderRadius: theme.radius.pill,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  brand: {
    ...theme.text.bodyStrong
  },
  eyebrow: {
    ...theme.text.eyebrow,
    marginTop: theme.spacing.xl
  },
  title: {
    ...theme.text.display,
    marginTop: theme.spacing.sm
  },
  intro: {
    ...theme.text.body,
    marginTop: theme.spacing.md
  },
  currentChoice: {
    alignItems: "center",
    backgroundColor: theme.colors.mist,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md
  },
  currentChoiceText: {
    ...theme.text.bodyStrong,
    flex: 1
  },
  cards: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl
  },
  cardHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  cardTitle: {
    ...theme.text.heading,
    flex: 1
  },
  cardBody: {
    ...theme.text.bodyMuted,
    marginTop: theme.spacing.sm
  },
  controlCopy: {
    ...theme.text.bodyMuted,
    marginTop: theme.spacing.lg
  },
  actions: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl
  },
  footer: {
    ...theme.text.caption,
    marginTop: theme.spacing.lg,
    textAlign: "center"
  }
});
