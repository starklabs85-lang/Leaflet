import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";

import { PremiumLockedScreen } from "@/components/payments/PremiumLockedScreen";
import { UpgradePrompt } from "@/components/payments/UpgradePrompt";
import { Button } from "@/components/ui/Button";
import { IconChip } from "@/components/ui/IconChip";
import { PlantImage } from "@/components/ui/PlantImage";
import { PressableScale } from "@/components/ui/PressableScale";
import { Screen } from "@/components/ui/Screen";
import { theme } from "@/constants/theme";
import { listCareTasksForPlant } from "@/lib/api/careSchedule";
import {
  createUserPlant,
  fetchSpeciesForSave
} from "@/lib/api/plantCollection";
import {
  checkCollectionAllowance,
  getCollectionCount
} from "@/lib/payments/limits";
import {
  markTrialIntroSeen,
  shouldShowTrialIntro
} from "@/lib/payments/trialIntro";
import { useEntitlement } from "@/providers/EntitlementProvider";
import {
  markCareReminderPromptSeen,
  requestAndEnableCareReminders,
  shouldPromptForCareReminders
} from "@/lib/notifications/careReminders";
import { PlantEnvironmentFields } from "@/components/plants/PlantEnvironmentFields";
import { useOnboarding } from "@/providers/OnboardingProvider";
import type {
  CollectionSpeciesSummary,
  LightExposure,
  PlantPlacement,
  PlantStatus
} from "@/types/plantCollection";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; species: CollectionSpeciesSummary }
  | { status: "error"; message: string };

const LOCATION_OPTIONS = [
  "Living room",
  "Bedroom",
  "Balcony",
  "Office",
  "Kitchen",
  "Bathroom"
];

const MAX_PHOTO_EDGE = 1400;
const MAX_NAME_LENGTH = 40;
const MAX_LOCATION_LENGTH = 40;

export default function SavePlantScreen() {
  const { isPremium } = useEntitlement();

  if (!isPremium) {
    return (
      <PremiumLockedScreen
        title="Saving plants requires Premium"
        message="Premium unlocks saved plants, collection setup, care schedules, reminders, and growth history."
        icon="content-save-outline"
      />
    );
  }

  return <PremiumSavePlantScreen />;
}

function PremiumSavePlantScreen() {
  const onboarding = useOnboarding();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    speciesId?: string | string[];
    photoUri?: string | string[];
  }>();
  const speciesId = Array.isArray(params.speciesId)
    ? params.speciesId[0]
    : params.speciesId;
  const sourcePhotoUri = Array.isArray(params.photoUri)
    ? params.photoUri[0]
    : params.photoUri;
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [nickname, setNickname] = useState("");
  const [location, setLocation] = useState("");
  const [placement, setPlacement] = useState<PlantPlacement>("unknown");
  const [lightExposure, setLightExposure] = useState<LightExposure>("unknown");
  const [status, setStatus] = useState<PlantStatus>("healthy");
  const [photoUri, setPhotoUri] = useState<string | null>(sourcePhotoUri ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const { isPremium } = useEntitlement();

  useEffect(() => {
    let isMounted = true;

    fetchSpeciesForSave(speciesId).then((result) => {
      if (!isMounted) {
        return;
      }

      if (!result.ok) {
        setLoadState({ status: "error", message: result.message });
        return;
      }

      setLoadState({ status: "ready", species: result.data });
    });

    return () => {
      isMounted = false;
    };
  }, [speciesId]);

  async function choosePhoto() {
    setMessage(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setMessage("Photo library access is needed to choose a plant photo.");
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      base64: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1
    });

    if (picked.canceled) {
      return;
    }

    const asset = picked.assets[0];

    if (!asset?.uri) {
      setMessage("That image could not be loaded.");
      return;
    }

    setPhotoUri(await preparePhoto(asset.uri, asset.width, asset.height));
  }

  async function takePhoto() {
    setMessage(null);

    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      setMessage("Camera access is needed to take a plant photo.");
      return;
    }

    const captured = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      base64: false,
      quality: 1
    });

    if (captured.canceled) {
      return;
    }

    const asset = captured.assets[0];

    if (!asset?.uri) {
      setMessage("The camera could not capture a photo.");
      return;
    }

    setPhotoUri(await preparePhoto(asset.uri, asset.width, asset.height));
  }

  async function savePlant() {
    if (loadState.status !== "ready") {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setLimitMessage(null);

    // Save is Premium-only; this remains as a second guard at the write point.
    const allowance = await checkCollectionAllowance(isPremium);

    if (!allowance.allowed) {
      setIsSaving(false);
      setLimitMessage(allowance.message);
      return;
    }

    let preparedSourcePhoto: string | null = photoUri;

    try {
      preparedSourcePhoto =
        photoUri && photoUri === sourcePhotoUri ? await preparePhoto(photoUri) : photoUri;
    } catch {
      setIsSaving(false);
      setMessage("Plant photo could not be prepared. Please choose another photo.");
      return;
    }

    const result = await createUserPlant({
      speciesId: loadState.species.id,
      nickname: nickname.trim(),
      fallbackName: loadState.species.commonName,
      location: location.trim(),
      placement,
      lightExposure,
      status,
      photoUri: preparedSourcePhoto
    });

    setIsSaving(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    // One-time trial intro after the very first plant (Phase 12/13): shown as
    // a celebration, dismissible, and never auto-shown again.
    let showTrialIntro = false;

    try {
      const [collectionCount, introUnseen] = await Promise.all([
        getCollectionCount(),
        shouldShowTrialIntro()
      ]);

      showTrialIntro = collectionCount === 1 && introUnseen && !isPremium;
    } catch {
      showTrialIntro = false;
    }

    let shouldShowActivation = false;

    try {
      shouldShowActivation = await onboarding.completeAfterPlantSave({
        plantId: result.data.id,
        plantName: result.data.displayName,
        waterInDays: await getWaterPreviewDays(result.data.id)
      });
    } catch {
      setMessage(
        "Plant saved. Onboarding status could not be updated on this device."
      );
    }

    if (showTrialIntro) {
      await markTrialIntroSeen();
      router.replace({
        pathname: "/(auth)/premium-intro" as never,
        params: {
          next: shouldShowActivation ? "activation" : "plant",
          plantId: result.data.id,
          plantName: result.data.displayName
        }
      });
      return;
    }

    if (shouldShowActivation) {
      router.replace("/(auth)/onboarding/activation" as never);
      return;
    }

    const openPlant = () =>
      router.replace({
        pathname: "/(auth)/plants/[plantId]" as never,
        params: { plantId: result.data.id }
      });

    if (!(await shouldPromptForCareReminders())) {
      Alert.alert("Plant saved", `${result.data.displayName} added to your collection.`, [
        {
          text: "View plant",
          onPress: openPlant
        }
      ]);
      return;
    }

    Alert.alert(
      "Plant saved",
      `${result.data.displayName} added to your collection. Enable care reminders for upcoming tasks?`,
      [
        {
          text: "Not now",
          style: "cancel",
          onPress: async () => {
            await markCareReminderPromptSeen();
            openPlant();
          }
        },
        {
          text: "View plant",
          onPress: async () => {
            await markCareReminderPromptSeen();
            openPlant();
          }
        },
        {
          text: "Enable reminders",
          onPress: async () => {
            const reminderResult = await requestAndEnableCareReminders();

            if (!reminderResult.ok) {
              Alert.alert("Reminders unavailable", reminderResult.message, [
                { text: "View plant", onPress: openPlant }
              ]);
              return;
            }

            openPlant();
          }
        }
      ]
    );
  }

  if (loadState.status === "loading") {
    return (
      <Screen contentContainerStyle={styles.stateContent}>
        <IconChip icon="sprout" size={72} />
        <Text style={styles.stateTitle}>Preparing save flow</Text>
        <Text style={styles.stateText}>Loading species details.</Text>
      </Screen>
    );
  }

  if (loadState.status === "error") {
    return (
      <Screen contentContainerStyle={styles.stateContent}>
        <IconChip
          background={theme.colors.blush}
          color={theme.colors.terra}
          icon="file-alert-outline"
          size={72}
        />
        <Text style={styles.stateTitle}>Cannot save this plant</Text>
        <Text style={styles.stateText}>{loadState.message}</Text>
        <Button
          accessibilityLabel="Go back"
          icon="arrow-left"
          label="Go back"
          onPress={() => router.back()}
          variant="secondary"
        />
      </Screen>
    );
  }

  const species = loadState.species;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <Screen
        footer={
          <View
            style={[
              styles.actionBar,
              { paddingBottom: insets.bottom + theme.spacing.md }
            ]}
          >
            <Button
              accessibilityLabel="Save plant to your collection"
              disabled={isSaving}
              gradient
              icon="check"
              label="Save plant"
              loading={isSaving}
              onPress={savePlant}
            />
          </View>
        }
      >
        <PressableScale
          accessibilityLabel="Go back"
          accessibilityRole="button"
          haptic={false}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons
            color={theme.colors.forest}
            name="chevron-left"
            size={24}
          />
          <Text style={styles.backText}>Back</Text>
        </PressableScale>

        <Text style={styles.eyebrow}>Add Plant</Text>
        <Text style={styles.title}>{species.commonName}</Text>
        <Text style={styles.subtitle}>
          {species.scientificName ?? "Scientific name unavailable"}
        </Text>

        <View style={styles.photoSection}>
          <PlantImage
            accessibilityLabel="Selected plant photo"
            fallbackIcon="image-plus"
            iconSize={44}
            style={styles.photo}
            uri={photoUri}
          />
          <View style={styles.photoActions}>
            <Button
              accessibilityLabel="Take a plant photo"
              fullWidth={false}
              icon="camera-outline"
              label="Take photo"
              onPress={takePhoto}
              style={styles.photoButton}
              variant="secondary"
            />
            <Button
              accessibilityLabel="Choose a plant photo from library"
              fullWidth={false}
              icon="image-multiple-outline"
              label="Choose"
              onPress={choosePhoto}
              style={styles.photoButton}
              variant="secondary"
            />
          </View>
        </View>

        <Text style={styles.label}>Nickname</Text>
        <TextInput
          maxLength={MAX_NAME_LENGTH}
          onChangeText={setNickname}
          placeholder={species.commonName}
          placeholderTextColor={theme.colors.moss}
          style={styles.input}
          value={nickname}
        />

        <Text style={styles.label}>Location</Text>
        <Text style={styles.hint}>Pick a spot or type your own below.</Text>
        <View style={styles.chips}>
          {LOCATION_OPTIONS.map((option) => {
            const selected = location === option;

            return (
              <PressableScale
                accessibilityLabel={`Set plant location to ${option}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option}
                onPress={() => setLocation(option)}
                style={[styles.chip, selected ? styles.chipSelected : null]}
              >
                <Text
                  style={[styles.chipText, selected ? styles.chipTextSelected : null]}
                >
                  {option}
                </Text>
              </PressableScale>
            );
          })}
        </View>
        <View style={styles.customField}>
          <MaterialCommunityIcons
            color={theme.colors.moss}
            name="map-marker-outline"
            size={20}
          />
          <TextInput
            maxLength={MAX_LOCATION_LENGTH}
            onChangeText={setLocation}
            placeholder="Custom location"
            placeholderTextColor={theme.colors.moss}
            style={styles.customInput}
            value={location}
          />
          {location.length > 0 ? (
            <PressableScale
              accessibilityLabel="Clear location"
              accessibilityRole="button"
              haptic={false}
              onPress={() => setLocation("")}
              style={styles.clearButton}
            >
              <MaterialCommunityIcons
                color={theme.colors.moss}
                name="close-circle"
                size={20}
              />
            </PressableScale>
          ) : null}
        </View>

        <PlantEnvironmentFields
          lightExposure={lightExposure}
          onChangeLightExposure={setLightExposure}
          onChangePlacement={setPlacement}
          placement={placement}
        />

        <Text style={styles.label}>Status</Text>
        <View style={styles.statusRow}>
          <StatusOption
            active={status === "healthy"}
            label="Healthy"
            onPress={() => setStatus("healthy")}
          />
          <StatusOption
            active={status === "needs_attention"}
            label="Needs attention"
            onPress={() => setStatus("needs_attention")}
          />
          <StatusOption
            active={status === "sick"}
            label="Sick"
            onPress={() => setStatus("sick")}
          />
        </View>

        {limitMessage ? (
          <UpgradePrompt
            message={limitMessage}
            onDismiss={() => setLimitMessage(null)}
            style={styles.limitPrompt}
            title="Collection limit reached"
          />
        ) : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

async function getWaterPreviewDays(plantId: string) {
  const result = await listCareTasksForPlant(plantId);

  if (!result.ok) {
    return null;
  }

  const waterTask = result.data.find(
    (task) => task.type === "water" && task.isActive
  );

  if (!waterTask) {
    return null;
  }

  return Math.max(0, waterTask.daysUntilDue);
}

async function preparePhoto(uri: string, width?: number, height?: number) {
  const longestEdge = Math.max(width ?? 0, height ?? 0);
  const actions =
    longestEdge > MAX_PHOTO_EDGE && width && height
      ? [
          width >= height
            ? { resize: { width: MAX_PHOTO_EDGE } }
            : { resize: { height: MAX_PHOTO_EDGE } }
        ]
      : [];

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.82,
    format: ImageManipulator.SaveFormat.JPEG
  });

  return result.uri;
}

function StatusOption({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityLabel={`Set plant status to ${label}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.statusOption, active ? styles.statusOptionActive : null]}
    >
      <MaterialCommunityIcons
        color={active ? theme.colors.forest : theme.colors.moss}
        name={active ? "check-circle" : "circle-outline"}
        size={20}
      />
      <Text
        style={[styles.statusOptionText, active ? styles.statusOptionTextActive : null]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  stateContent: {
    alignItems: "center",
    flexGrow: 1,
    gap: theme.spacing.sm,
    justifyContent: "center"
  },
  stateTitle: {
    ...theme.text.title,
    marginTop: theme.spacing.md,
    textAlign: "center"
  },
  stateText: {
    ...theme.text.body,
    color: theme.colors.moss,
    marginBottom: theme.spacing.md,
    textAlign: "center"
  },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    minHeight: 44
  },
  backText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.body
  },
  eyebrow: {
    ...theme.text.eyebrow,
    marginTop: theme.spacing.lg
  },
  title: {
    ...theme.text.display,
    marginTop: theme.spacing.sm
  },
  subtitle: {
    color: theme.colors.moss,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.body,
    fontStyle: "italic",
    lineHeight: 24,
    marginTop: theme.spacing.xs
  },
  photoSection: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl
  },
  photo: {
    aspectRatio: 1.2,
    borderRadius: theme.radius.card,
    width: "100%"
  },
  photoActions: {
    flexDirection: "row",
    gap: theme.spacing.md
  },
  photoButton: {
    flex: 1
  },
  label: {
    ...theme.text.label,
    fontSize: theme.typography.body,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.xl
  },
  hint: {
    ...theme.text.caption,
    marginBottom: theme.spacing.md,
    marginTop: -theme.spacing.xs
  },
  input: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.colors.ink,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.body,
    minHeight: 52,
    paddingHorizontal: theme.spacing.md
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md
  },
  chip: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  chipSelected: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest
  },
  chipText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.caption
  },
  chipTextSelected: {
    color: theme.colors.white
  },
  customField: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md
  },
  customInput: {
    color: theme.colors.ink,
    flex: 1,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.body,
    minHeight: 52
  },
  clearButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
    minWidth: 32
  },
  statusRow: {
    gap: theme.spacing.sm
  },
  statusOption: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: theme.spacing.sm,
    minHeight: 52,
    paddingHorizontal: theme.spacing.md
  },
  statusOptionActive: {
    backgroundColor: theme.colors.leafMuted,
    borderColor: theme.colors.forest
  },
  statusOptionText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.body
  },
  statusOptionTextActive: {
    color: theme.colors.forest
  },
  message: {
    color: theme.colors.terra,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.body,
    lineHeight: 24,
    marginTop: theme.spacing.lg
  },
  limitPrompt: {
    marginTop: theme.spacing.lg
  },
  actionBar: {
    backgroundColor: theme.colors.paper,
    borderTopColor: theme.colors.line,
    borderTopWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md
  }
});
