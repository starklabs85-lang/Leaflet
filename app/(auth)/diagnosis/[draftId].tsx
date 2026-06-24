import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { PremiumLockedScreen } from "@/components/payments/PremiumLockedScreen";
import { PlantImage } from "@/components/ui/PlantImage";
import { theme } from "@/constants/theme";
import { saveDiagnosis } from "@/lib/api/diagnosis";
import { listUserPlants } from "@/lib/api/plantCollection";
import { getDiagnosisDraft } from "@/lib/diagnosisDraftStore";
import { useEntitlement } from "@/providers/EntitlementProvider";
import type { DiagnosisDraft, SavedDiagnosis } from "@/types/diagnosis";
import { DIAGNOSIS_ADVISORY } from "@/types/diagnosis";
import type { SavedPlant } from "@/types/plantCollection";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; draft: DiagnosisDraft; plants: SavedPlant[] }
  | { status: "missing" };

export default function DiagnosisResultScreen() {
  const { isPremium } = useEntitlement();

  if (!isPremium) {
    return (
      <PremiumLockedScreen
        title="Diagnosis requires Premium"
        message="Disease and pest diagnosis, treatment plans, follow-up reminders, and diagnosis history are included with Premium."
        icon="stethoscope"
      />
    );
  }

  return <PremiumDiagnosisResultScreen />;
}

function PremiumDiagnosisResultScreen() {
  const params = useLocalSearchParams<{ draftId?: string | string[] }>();
  const draftId = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId;
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [savingTarget, setSavingTarget] = useState<"plant" | "standalone" | null>(null);
  const [savedDiagnosis, setSavedDiagnosis] = useState<SavedDiagnosis | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const draft = getDiagnosisDraft(draftId);

    if (!draft) {
      setLoadState({ status: "missing" });
      return;
    }

    setSelectedPlantId(draft.sourcePlantId);
    listUserPlants().then((result) => {
      if (!mounted) {
        return;
      }

      setLoadState({
        status: "ready",
        draft,
        plants: result.ok ? result.data : []
      });

      if (!result.ok) {
        setMessage(result.message);
      }
    });

    return () => {
      mounted = false;
    };
  }, [draftId]);

  async function saveResult(target: "plant" | "standalone") {
    if (loadState.status !== "ready") {
      return;
    }

    setSavingTarget(target);
    setMessage(null);

    const result = await saveDiagnosis({
      result: loadState.draft.result,
      userPlantId: target === "plant" ? selectedPlantId : null
    });

    setSavingTarget(null);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setSavedDiagnosis(result.data);
    setMessage(
      result.data.userPlantId
        ? "Diagnosis attached to plant."
        : "Diagnosis saved without a plant."
    );
  }

  if (loadState.status === "loading") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.statePanel}>
          <ActivityIndicator color={theme.colors.forest} size="large" />
          <Text style={styles.stateTitle}>Loading diagnosis</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadState.status === "missing") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.statePanel}>
          <MaterialCommunityIcons
            color={theme.colors.terra}
            name="file-alert-outline"
            size={42}
          />
          <Text style={styles.stateTitle}>Diagnosis unavailable</Text>
          <Text style={styles.stateText}>Run the diagnosis again to review the result.</Text>
          <Pressable
            accessibilityLabel="Scan again"
            accessibilityRole="button"
            style={styles.primaryButton}
            onPress={() =>
              router.replace({
                pathname: "/(auth)/(tabs)/scan" as never,
                params: { mode: "diagnose" }
              })
            }
          >
            <Text style={styles.primaryButtonText}>Scan again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { draft, plants } = loadState;
  const selectedPlant = plants.find((plant) => plant.id === selectedPlantId) ?? null;
  const result = draft.result;
  const severity = getSeverityDisplay(result.severity, result.isHealthy);
  const confidencePercent = Math.round(result.condition.confidence * 100);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <PlantImage
          accessibilityLabel="Diagnosed plant photo"
          fallbackIcon="leaf"
          iconSize={64}
          style={styles.photo}
          uri={draft.photoUri}
        />
        <View style={styles.panel}>
          <Pressable
            accessibilityLabel="Scan again"
            accessibilityRole="button"
            style={styles.backButton}
            onPress={() =>
              router.replace({
                pathname: "/(auth)/(tabs)/scan" as never,
                params: { mode: "diagnose" }
              })
            }
          >
            <MaterialCommunityIcons
              color={theme.colors.forest}
              name="chevron-left"
              size={24}
            />
            <Text style={styles.backText}>Scan again</Text>
          </Pressable>

          {result.isHealthy ? (
            <View style={styles.healthyHeader}>
              <MaterialCommunityIcons color={theme.colors.leaf} name="leaf" size={42} />
              <Text style={styles.title}>Your plant looks healthy</Text>
              <Text style={styles.description}>
                If something still looks off, try photographing the specific area more
                closely.
              </Text>
            </View>
          ) : (
            <View>
              <Text style={styles.eyebrow}>Diagnosis</Text>
              <Text style={styles.title}>{result.condition.name}</Text>
            </View>
          )}

          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: severity.color }]}>
              <Text style={styles.badgeText}>{severity.label}</Text>
            </View>
            <View style={styles.outlineBadge}>
              <Text style={styles.outlineBadgeText}>{confidencePercent}% confidence</Text>
            </View>
            <View style={styles.outlineBadge}>
              <Text style={styles.outlineBadgeText}>
                {formatCategory(result.condition.category)}
              </Text>
            </View>
          </View>

          <InfoSection title="Likely cause">
            <Text style={styles.description}>{result.cause}</Text>
          </InfoSection>

          <InfoSection title="Treatment plan">
            {result.treatment.map((step, index) => (
              <View key={`${step}-${index}`} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </InfoSection>

          <InfoSection title="Prevention">
            <Text style={styles.description}>{result.prevention}</Text>
          </InfoSection>

          <View style={styles.followUpBox}>
            <MaterialCommunityIcons
              color={theme.colors.forest}
              name="calendar-clock"
              size={22}
            />
            <Text style={styles.followUpText}>
              Follow-up prepared for {result.followUpDays || 7} days from save.
            </Text>
          </View>

          <Text style={styles.disclaimer}>{DIAGNOSIS_ADVISORY}</Text>

          <View style={styles.attachPanel}>
            <Text style={styles.sectionTitle}>Save diagnosis</Text>
            {draft.sourcePlantName ? (
              <Text style={styles.description}>
                Started from {draft.sourcePlantName}. You can attach it there or save it
                without a plant.
              </Text>
            ) : null}
            {plants.length > 0 ? (
              <View style={styles.plantList}>
                {plants.map((plant) => (
                  <Pressable
                    accessibilityLabel={`Attach diagnosis to ${plant.displayName}`}
                    accessibilityRole="button"
                    key={plant.id}
                    onPress={() => setSelectedPlantId(plant.id)}
                    style={[
                      styles.plantChoice,
                      selectedPlantId === plant.id ? styles.plantChoiceActive : null
                    ]}
                  >
                    <View style={styles.plantChoiceText}>
                      <Text style={styles.plantName}>{plant.displayName}</Text>
                      <Text style={styles.plantSpecies}>
                        {plant.species?.commonName ?? "Species unavailable"}
                      </Text>
                    </View>
                    {selectedPlantId === plant.id ? (
                      <MaterialCommunityIcons
                        color={theme.colors.leaf}
                        name="check-circle"
                        size={22}
                      />
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.description}>
                No tracked plants are available. You can still save this result without a
                plant.
              </Text>
            )}

            {message ? <Text style={styles.message}>{message}</Text> : null}

            <View style={styles.actions}>
              <Pressable
                accessibilityLabel="Attach diagnosis to selected plant"
                accessibilityRole="button"
                disabled={!selectedPlantId || Boolean(savingTarget) || Boolean(savedDiagnosis)}
                style={[
                  styles.primaryButton,
                  !selectedPlantId || savingTarget || savedDiagnosis
                    ? styles.disabledButton
                    : null
                ]}
                onPress={() => saveResult("plant")}
              >
                {savingTarget === "plant" ? (
                  <ActivityIndicator color={theme.colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {selectedPlant ? `Attach to ${selectedPlant.displayName}` : "Attach to plant"}
                  </Text>
                )}
              </Pressable>
              <Pressable
                accessibilityLabel="Save diagnosis without a plant"
                accessibilityRole="button"
                disabled={Boolean(savingTarget) || Boolean(savedDiagnosis)}
                style={[
                  styles.secondaryButton,
                  savingTarget || savedDiagnosis ? styles.disabledButton : null
                ]}
                onPress={() => saveResult("standalone")}
              >
                {savingTarget === "standalone" ? (
                  <ActivityIndicator color={theme.colors.forest} />
                ) : (
                  <Text style={styles.secondaryButtonText}>Save without plant</Text>
                )}
              </Pressable>
              {savedDiagnosis?.userPlantId ? (
                <Pressable
                  accessibilityLabel="Open plant for saved diagnosis"
                  accessibilityRole="button"
                  style={styles.secondaryButton}
                  onPress={() =>
                    router.replace({
                      pathname: "/(auth)/plants/[plantId]" as never,
                      params: { plantId: savedDiagnosis.userPlantId }
                    })
                  }
                >
                  <Text style={styles.secondaryButtonText}>Open plant</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoSection({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <View style={styles.infoSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function getSeverityDisplay(severity: string, isHealthy: boolean) {
  if (isHealthy) {
    return { label: "Healthy", color: theme.colors.leaf };
  }

  if (severity === "severe") {
    return { label: "Severe", color: theme.colors.terra };
  }

  if (severity === "moderate") {
    return { label: "Moderate", color: theme.colors.ochre };
  }

  return { label: "Mild", color: theme.colors.leaf };
}

function formatCategory(category: string) {
  switch (category) {
    case "nutrient_deficiency":
      return "Nutrient deficiency";
    case "environmental":
      return "Environmental";
    case "disease":
      return "Disease";
    case "pest":
      return "Pest";
    default:
      return "Unknown";
  }
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.colors.paper,
    flex: 1
  },
  content: {
    paddingBottom: theme.spacing.xxl
  },
  photo: {
    height: 300,
    width: "100%"
  },
  panel: {
    padding: theme.spacing.xl
  },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    marginBottom: theme.spacing.lg,
    minHeight: 44
  },
  backText: {
    color: theme.colors.forest,
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bodyBlack
  },
  eyebrow: {
    color: theme.colors.leaf,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bodyBlack,
    letterSpacing: 1,
    marginBottom: theme.spacing.sm,
    textTransform: "uppercase"
  },
  title: {
    color: theme.colors.forest,
    fontSize: theme.typography.display,
    fontFamily: theme.typography.fontFamily.displayBold,
    lineHeight: 40
  },
  healthyHeader: {
    alignItems: "flex-start",
    gap: theme.spacing.sm
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg
  },
  badge: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  badgeText: {
    color: theme.colors.white,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bodyBlack
  },
  outlineBadge: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  outlineBadgeText: {
    color: theme.colors.forest,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bodyBlack
  },
  infoSection: {
    marginTop: theme.spacing.xl
  },
  sectionTitle: {
    color: theme.colors.forest,
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.display,
    marginBottom: theme.spacing.sm
  },
  description: {
    color: theme.colors.ink,
    fontSize: theme.typography.body,
    lineHeight: 24
  },
  stepRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  stepNumber: {
    alignItems: "center",
    backgroundColor: theme.colors.leafMuted,
    borderRadius: theme.radius.pill,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  stepNumberText: {
    color: theme.colors.forest,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bodyBlack
  },
  stepText: {
    color: theme.colors.ink,
    flex: 1,
    fontSize: theme.typography.body,
    lineHeight: 24
  },
  followUpBox: {
    alignItems: "center",
    backgroundColor: theme.colors.leafMuted,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    ...theme.shadow.soft,
    flexDirection: "row",
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
    padding: theme.spacing.md
  },
  followUpText: {
    color: theme.colors.forest,
    flex: 1,
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bodyBold,
    lineHeight: 22
  },
  disclaimer: {
    backgroundColor: theme.colors.blush,
    borderColor: theme.colors.terra,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    color: theme.colors.ink,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bodyBold,
    lineHeight: 18,
    marginTop: theme.spacing.xl,
    padding: theme.spacing.md
  },
  attachPanel: {
    marginTop: theme.spacing.xl
  },
  plantList: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md
  },
  plantChoice: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    ...theme.shadow.soft,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 66,
    padding: theme.spacing.md
  },
  plantChoiceActive: {
    backgroundColor: theme.colors.leafMuted,
    borderColor: theme.colors.leaf
  },
  plantChoiceText: {
    flex: 1,
    paddingRight: theme.spacing.md
  },
  plantName: {
    color: theme.colors.forest,
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bodyBlack
  },
  plantSpecies: {
    color: theme.colors.moss,
    fontSize: theme.typography.caption,
    marginTop: theme.spacing.xs
  },
  actions: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.forest,
    borderRadius: theme.radius.card,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: theme.spacing.lg
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bodyBlack,
    textAlign: "center"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.leafMuted,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    ...theme.shadow.soft,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: theme.spacing.md
  },
  secondaryButtonText: {
    color: theme.colors.forest,
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bodyBlack,
    textAlign: "center"
  },
  disabledButton: {
    opacity: 0.55
  },
  message: {
    color: theme.colors.terra,
    fontSize: theme.typography.body,
    lineHeight: 24,
    marginTop: theme.spacing.lg
  },
  statePanel: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: theme.spacing.xl
  },
  stateTitle: {
    color: theme.colors.forest,
    fontSize: theme.typography.title,
    fontFamily: theme.typography.fontFamily.displayBold,
    marginTop: theme.spacing.lg,
    textAlign: "center"
  },
  stateText: {
    color: theme.colors.moss,
    fontSize: theme.typography.body,
    lineHeight: 24,
    marginBottom: theme.spacing.xl,
    marginTop: theme.spacing.sm,
    textAlign: "center"
  }
});
