import type { ComponentProps } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";

import { PremiumLockedScreen } from "@/components/payments/PremiumLockedScreen";
import { UpgradePrompt } from "@/components/payments/UpgradePrompt";
import { PlantEnvironmentFields } from "@/components/plants/PlantEnvironmentFields";
import { PlantImage } from "@/components/ui/PlantImage";
import { PlantWeatherNote } from "@/components/weather/PlantWeatherNote";
import { theme } from "@/constants/theme";
import {
  ANALYTICS_EVENTS,
  trackAction
} from "@/lib/analytics/firebaseAnalytics";
import {
  applyOptimisticQuickLog,
  ensureCareTasksForPlant,
  formatCareType,
  listCareLogsForPlant,
  listCareTasksForPlant,
  quickLogCare,
  sortCareTasks,
  updateCareTask
} from "@/lib/api/careSchedule";
import { listDiagnosesForPlant } from "@/lib/api/diagnosis";
import {
  addGrowthPhoto,
  listGrowthPhotosForPlant
} from "@/lib/api/growthTimeline";
import {
  deleteUserPlant,
  fetchUserPlant,
  updateUserPlant
} from "@/lib/api/plantCollection";
import { preparePlantPhoto } from "@/lib/media/plantPhotos";
import { checkGrowthPhotoAllowance } from "@/lib/payments/limits";
import { useEntitlement } from "@/providers/EntitlementProvider";
import type {
  CareLog,
  CareLogType,
  CareTask,
  CareTaskType
} from "@/types/careSchedule";
import { DIAGNOSIS_ADVISORY, type SavedDiagnosis } from "@/types/diagnosis";
import type { GrowthPhoto } from "@/types/growthTimeline";
import type {
  LightExposure,
  PlantPlacement,
  PlantStatus,
  SavedPlant
} from "@/types/plantCollection";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type LoadState =
  | { status: "loading" }
  | {
      status: "ready";
      plant: SavedPlant;
      tasks: CareTask[];
      logs: CareLog[];
      diagnoses: SavedDiagnosis[];
      growthPhotos: GrowthPhoto[];
      careError: string | null;
      diagnosisError: string | null;
      growthError: string | null;
    }
  | { status: "error"; message: string };

const QUICK_LOG_ACTIONS: CareLogType[] = [
  "water",
  "fertilize",
  "repot",
  "prune",
  "mist",
  "note"
];

export default function PlantDetailScreen() {
  const { isPremium } = useEntitlement();

  if (!isPremium) {
    return (
      <PremiumLockedScreen
        title="Plant details require Premium"
        message="Plant profiles, care tasks, diagnosis history, weather notes, and growth photos are included with Premium."
        icon="leaf-circle-outline"
      />
    );
  }

  return <PremiumPlantDetailScreen />;
}

function PremiumPlantDetailScreen() {
  const params = useLocalSearchParams<{ plantId?: string | string[] }>();
  const plantId = Array.isArray(params.plantId) ? params.plantId[0] : params.plantId;
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState("");
  const [location, setLocation] = useState("");
  const [placement, setPlacement] = useState<PlantPlacement>("unknown");
  const [lightExposure, setLightExposure] = useState<LightExposure>("unknown");
  const [status, setStatus] = useState<PlantStatus>("healthy");
  const [replacementPhotoUri, setReplacementPhotoUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [careMessage, setCareMessage] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [pendingAction, setPendingAction] = useState<CareLogType | null>(null);
  const [confirmedAction, setConfirmedAction] = useState<CareLogType | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDrafts, setTaskDrafts] = useState<Record<string, string>>({});
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [expandedDiagnosisId, setExpandedDiagnosisId] = useState<string | null>(null);
  const [growthNote, setGrowthNote] = useState("");
  const [pendingGrowthSource, setPendingGrowthSource] = useState<
    "camera" | "library" | null
  >(null);
  const [selectedGrowthPhoto, setSelectedGrowthPhoto] =
    useState<GrowthPhoto | null>(null);
  const [growthLimitMessage, setGrowthLimitMessage] = useState<string | null>(null);
  const { isPremium } = useEntitlement();

  const loadPlant = useCallback(async () => {
    setLoadState({ status: "loading" });
    setCareMessage(null);

    const result = await fetchUserPlant(plantId);

    if (!result.ok) {
      setLoadState({ status: "error", message: result.message });
      return;
    }

    const ensureResult = await ensureCareTasksForPlant(result.data.id);
    let careError = ensureResult.ok ? null : ensureResult.message;

    const [tasksResult, logsResult, diagnosesResult, growthResult] = await Promise.all([
      listCareTasksForPlant(result.data.id),
      listCareLogsForPlant(result.data.id),
      listDiagnosesForPlant(result.data.id),
      listGrowthPhotosForPlant(result.data.id)
    ]);

    const tasks = tasksResult.ok
      ? tasksResult.data
      : ensureResult.ok
        ? ensureResult.data.tasks
        : [];
    const logs = logsResult.ok ? logsResult.data : [];
    const diagnoses = diagnosesResult.ok ? diagnosesResult.data : [];
    const growthPhotos = growthResult.ok ? growthResult.data : [];

    if (!tasksResult.ok) {
      careError = tasksResult.message;
    } else if (!logsResult.ok) {
      careError = logsResult.message;
    }

    setLoadState({
      status: "ready",
      plant: result.data,
      tasks,
      logs,
      diagnoses,
      growthPhotos,
      careError,
      diagnosisError: diagnosesResult.ok ? null : diagnosesResult.message,
      growthError: growthResult.ok ? null : growthResult.message
    });
    setTaskDrafts(buildTaskDrafts(tasks));
    setNickname(result.data.nickname ?? "");
    setLocation(result.data.location ?? "");
    setPlacement(result.data.placement);
    setLightExposure(result.data.lightExposure);
    setStatus(result.data.status);
    setReplacementPhotoUri(null);
  }, [plantId]);

  useEffect(() => {
    loadPlant();
  }, [loadPlant]);

  async function chooseReplacementPhoto() {
    setMessage(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    void trackAction(ANALYTICS_EVENTS.LIBRARY_PERMISSION_RESULT, {
      result: permission.granted ? "granted" : "denied",
      source: "plant_detail"
    });

    if (!permission.granted) {
      setMessage("Photo library access is needed to replace the plant photo.");
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      base64: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1
    });

    if (picked.canceled) {
      void trackAction(ANALYTICS_EVENTS.PLANT_PHOTO_REPLACEMENT, {
        result: "cancelled",
        source: "library",
        surface: "plant_detail"
      });
      return;
    }

    const asset = picked.assets[0];

    if (!asset?.uri) {
      void trackAction(ANALYTICS_EVENTS.PLANT_PHOTO_REPLACEMENT, {
        reason: "missing_photo",
        result: "failure",
        source: "library",
        surface: "plant_detail"
      });
      setMessage("That image could not be loaded.");
      return;
    }

    setReplacementPhotoUri(
      await preparePlantPhoto(asset.uri, asset.width, asset.height, {
        compress: 0.82,
        maxEdge: 1400
      })
    );
    void trackAction(ANALYTICS_EVENTS.PLANT_PHOTO_REPLACEMENT, {
      result: "success",
      source: "library",
      surface: "plant_detail"
    });
  }

  async function takeReplacementPhoto() {
    setMessage(null);

    const permission = await ImagePicker.requestCameraPermissionsAsync();

    void trackAction(ANALYTICS_EVENTS.CAMERA_PERMISSION_RESULT, {
      result: permission.granted ? "granted" : "denied",
      source: "plant_detail"
    });

    if (!permission.granted) {
      setMessage("Camera access is needed to replace the plant photo.");
      return;
    }

    const captured = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      base64: false,
      quality: 1
    });

    if (captured.canceled) {
      void trackAction(ANALYTICS_EVENTS.PLANT_PHOTO_REPLACEMENT, {
        result: "cancelled",
        source: "camera",
        surface: "plant_detail"
      });
      return;
    }

    const asset = captured.assets[0];

    if (!asset?.uri) {
      void trackAction(ANALYTICS_EVENTS.PLANT_PHOTO_REPLACEMENT, {
        reason: "missing_photo",
        result: "failure",
        source: "camera",
        surface: "plant_detail"
      });
      setMessage("The camera could not capture a photo.");
      return;
    }

    setReplacementPhotoUri(
      await preparePlantPhoto(asset.uri, asset.width, asset.height, {
        compress: 0.82,
        maxEdge: 1400
      })
    );
    void trackAction(ANALYTICS_EVENTS.PLANT_PHOTO_REPLACEMENT, {
      result: "success",
      source: "camera",
      surface: "plant_detail"
    });
  }

  async function saveChanges() {
    if (loadState.status !== "ready") {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const result = await updateUserPlant({
      plantId: loadState.plant.id,
      nickname,
      location,
      placement,
      lightExposure,
      status,
      photoUri: replacementPhotoUri
    });

    setIsSaving(false);

    if (!result.ok) {
      setMessage(result.message);
      void trackAction(ANALYTICS_EVENTS.PLANT_UPDATE_RESULT, {
        reason: result.code,
        result: "failure"
      });
      return;
    }

    void trackAction(ANALYTICS_EVENTS.PLANT_UPDATE_RESULT, {
      changed_photo: Boolean(replacementPhotoUri),
      result: "success"
    });
    setLoadState({
      ...loadState,
      plant: result.data
    });
    setReplacementPhotoUri(null);
    setIsEditing(false);
    setMessage("Plant updated.");
  }

  async function logCareAction(type: CareLogType) {
    if (loadState.status !== "ready" || pendingAction) {
      return;
    }

    const snapshot = loadState;
    setCareMessage(null);
    setPendingAction(type);

    setLoadState({
      ...loadState,
      tasks: applyOptimisticQuickLog(loadState.tasks, type)
    });

    const result = await quickLogCare({
      userPlantId: loadState.plant.id,
      type,
      note: noteText
    });

    setPendingAction(null);

    if (!result.ok) {
      setLoadState(snapshot);
      setCareMessage(
        result.rolledBack ? "No changes were saved. Please try again." : result.message
      );
      void trackAction(ANALYTICS_EVENTS.CARE_LOG_RESULT, {
        reason: result.code,
        result: "failure",
        type
      });
      return;
    }

    void trackAction(ANALYTICS_EVENTS.CARE_LOG_RESULT, {
      result: "success",
      type
    });
    setLoadState((current) => {
      if (current.status !== "ready" || current.plant.id !== snapshot.plant.id) {
        return current;
      }

      const tasks = result.data.updatedTask
        ? current.tasks.map((task) =>
            task.id === result.data.updatedTask?.id ? result.data.updatedTask : task
          )
        : current.tasks;

      return {
        ...current,
        tasks: sortCareTasks(tasks),
        logs: [
          result.data.log,
          ...current.logs.filter((log) => log.id !== result.data.log.id)
        ],
        careError: null
      };
    });
    setNoteText("");
    setConfirmedAction(type);
    setTimeout(() => setConfirmedAction(null), 1200);
  }

  async function addGrowthPhotoFrom(source: "camera" | "library") {
    if (loadState.status !== "ready" || pendingGrowthSource) {
      return;
    }

    setCareMessage(null);
    setMessage(null);
    setGrowthLimitMessage(null);

    const allowance = await checkGrowthPhotoAllowance({
      isPremium,
      userPlantId: loadState.plant.id
    });

    if (!allowance.allowed) {
      setGrowthLimitMessage(allowance.message);
      void trackAction(ANALYTICS_EVENTS.GROWTH_PHOTO_ADD, {
        reason: "limit",
        result: "failure",
        source
      });
      return;
    }

    setPendingGrowthSource(source);

    try {
      const asset =
        source === "camera"
          ? await captureGrowthPhotoAsset()
          : await pickGrowthPhotoAsset();

      if (!asset) {
        setPendingGrowthSource(null);
        void trackAction(ANALYTICS_EVENTS.GROWTH_PHOTO_ADD, {
          result: "cancelled",
          source
        });
        return;
      }

      const preparedUri = await preparePlantPhoto(
        asset.uri,
        asset.width,
        asset.height
      );
      const result = await addGrowthPhoto({
        userPlantId: loadState.plant.id,
        photoUri: preparedUri,
        note: growthNote
      });

      if (!result.ok) {
        setCareMessage(result.message);
        setPendingGrowthSource(null);
        void trackAction(ANALYTICS_EVENTS.GROWTH_PHOTO_ADD, {
          reason: result.code,
          result: "failure",
          source
        });
        return;
      }

      void trackAction(ANALYTICS_EVENTS.GROWTH_PHOTO_ADD, {
        result: "success",
        source
      });
      setLoadState((current) => {
        if (current.status !== "ready" || current.plant.id !== loadState.plant.id) {
          return current;
        }

        return {
          ...current,
          growthPhotos: [...current.growthPhotos, result.data],
          growthError: null
        };
      });
      setGrowthNote("");
      setCareMessage("Growth photo added.");
    } catch {
      setCareMessage("Growth photo could not be prepared. Please try another photo.");
      void trackAction(ANALYTICS_EVENTS.GROWTH_PHOTO_ADD, {
        reason: "photo_prepare",
        result: "failure",
        source
      });
    } finally {
      setPendingGrowthSource(null);
    }
  }

  async function pickGrowthPhotoAsset() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    void trackAction(ANALYTICS_EVENTS.LIBRARY_PERMISSION_RESULT, {
      result: permission.granted ? "granted" : "denied",
      source: "growth_photo"
    });

    if (!permission.granted) {
      setCareMessage("Photo library access is needed to add a growth photo.");
      return null;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      base64: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1
    });

    if (picked.canceled) {
      return null;
    }

    const asset = picked.assets[0];

    if (!asset?.uri) {
      setCareMessage("That image could not be loaded.");
      return null;
    }

    return asset;
  }

  async function captureGrowthPhotoAsset() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    void trackAction(ANALYTICS_EVENTS.CAMERA_PERMISSION_RESULT, {
      result: permission.granted ? "granted" : "denied",
      source: "growth_photo"
    });

    if (!permission.granted) {
      setCareMessage("Camera access is needed to add a growth photo.");
      return null;
    }

    const captured = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      base64: false,
      quality: 1
    });

    if (captured.canceled) {
      return null;
    }

    const asset = captured.assets[0];

    if (!asset?.uri) {
      setCareMessage("The camera could not capture a photo.");
      return null;
    }

    return asset;
  }

  async function saveTask(task: CareTask) {
    if (loadState.status !== "ready") {
      return;
    }

    const rawInterval = (taskDrafts[task.id] ?? "").trim();
    const intervalDays = Number(rawInterval);

    if (!/^\d+$/.test(rawInterval) || intervalDays < 1 || intervalDays > 365) {
      setEditingTaskId(task.id);
      setCareMessage("Enter a whole number of days between 1 and 365.");
      void trackAction(ANALYTICS_EVENTS.TASK_INTERVAL_UPDATE, {
        reason: "invalid_input",
        result: "failure",
        task_type: task.type
      });
      return;
    }

    setSavingTaskId(task.id);
    setCareMessage(null);

    const result = await updateCareTask({
      taskId: task.id,
      userPlantId: loadState.plant.id,
      intervalDays,
      isActive: task.isActive
    });

    setSavingTaskId(null);

    if (!result.ok) {
      setCareMessage(result.message);
      void trackAction(ANALYTICS_EVENTS.TASK_INTERVAL_UPDATE, {
        reason: result.code,
        result: "failure",
        task_type: task.type
      });
      return;
    }

    void trackAction(ANALYTICS_EVENTS.TASK_INTERVAL_UPDATE, {
      interval_days: intervalDays,
      result: "success",
      task_type: task.type
    });
    replaceTask(result.data);
    setEditingTaskId(null);
  }

  async function toggleTask(task: CareTask) {
    if (loadState.status !== "ready") {
      return;
    }

    setSavingTaskId(task.id);
    setCareMessage(null);

    const result = await updateCareTask({
      taskId: task.id,
      userPlantId: loadState.plant.id,
      intervalDays: task.intervalDays,
      isActive: !task.isActive
    });

    setSavingTaskId(null);

    if (!result.ok) {
      setCareMessage(result.message);
      void trackAction(ANALYTICS_EVENTS.TASK_TOGGLE, {
        enabled: !task.isActive,
        reason: result.code,
        result: "failure",
        task_type: task.type
      });
      return;
    }

    void trackAction(ANALYTICS_EVENTS.TASK_TOGGLE, {
      enabled: result.data.isActive,
      result: "success",
      task_type: task.type
    });
    replaceTask(result.data);
  }

  function replaceTask(task: CareTask) {
    setLoadState((current) => {
      if (current.status !== "ready") {
        return current;
      }

      return {
        ...current,
        tasks: sortCareTasks(
          current.tasks.map((existingTask) =>
            existingTask.id === task.id ? task : existingTask
          )
        ),
        careError: null
      };
    });
    setTaskDrafts((current) => ({
      ...current,
      [task.id]: String(task.intervalDays)
    }));
  }

  function startTaskEdit(task: CareTask) {
    setEditingTaskId(task.id);
    setTaskDrafts((current) => ({
      ...current,
      [task.id]: String(task.intervalDays)
    }));
  }

  function confirmDelete() {
    if (loadState.status !== "ready") {
      return;
    }

    void trackAction(ANALYTICS_EVENTS.PLANT_DELETE_PROMPT, {
      source: "plant_detail"
    });
    Alert.alert(
      "Remove plant?",
      `Remove ${loadState.plant.displayName} from your collection? This will also remove its care schedule and history.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const result = await deleteUserPlant(loadState.plant.id);

            if (!result.ok) {
              setMessage(result.message);
              void trackAction(ANALYTICS_EVENTS.PLANT_DELETE_RESULT, {
                reason: result.code,
                result: "failure"
              });
              return;
            }

            void trackAction(ANALYTICS_EVENTS.PLANT_DELETE_RESULT, {
              result: "success"
            });
            router.replace("/(auth)/(tabs)/plants");
          }
        }
      ]
    );
  }

  function toggleDiagnosis(diagnosisId: string) {
    const isExpanding = expandedDiagnosisId !== diagnosisId;

    void trackAction(ANALYTICS_EVENTS.DIAGNOSIS_EXPAND, {
      expanded: isExpanding
    });
    setExpandedDiagnosisId(isExpanding ? diagnosisId : null);
  }

  if (loadState.status === "loading") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.statePanel}>
          <ActivityIndicator color={theme.colors.forest} size="large" />
          <Text style={styles.stateTitle}>Loading plant</Text>
          <Text style={styles.stateText}>Checking your collection.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadState.status === "error") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.statePanel}>
          <MaterialCommunityIcons
            color={theme.colors.terra}
            name="magnify-close"
            size={42}
          />
          <Text style={styles.stateTitle}>Plant not found</Text>
          <Text style={styles.stateText}>{loadState.message}</Text>
          <View style={styles.stateActions}>
            <Pressable style={styles.primaryButton} onPress={loadPlant}>
              <Text style={styles.primaryButtonText}>Retry</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.replace("/(auth)/(tabs)/plants")}
            >
              <Text style={styles.secondaryButtonText}>Open collection</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const plant = loadState.plant;
  const statusDisplay = getStatusDisplay(plant.status);
  const visiblePhotoUri = replacementPhotoUri ?? plant.photoUrl;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.screen}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable
            accessibilityLabel="Open plant collection"
            accessibilityRole="button"
            style={styles.backButton}
            onPress={() => router.replace("/(auth)/(tabs)/plants")}
          >
            <MaterialCommunityIcons
              color={theme.colors.forest}
              name="chevron-left"
              size={24}
            />
            <Text style={styles.backText}>Collection</Text>
          </Pressable>
          <PlantImage
            accessibilityLabel={`${plant.displayName} photo`}
            iconSize={68}
            style={styles.heroImage}
            uri={visiblePhotoUri}
          />

          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              <Text style={styles.title}>{plant.displayName}</Text>
              <Text style={styles.subtitle}>
                {plant.species?.commonName ?? "Species unavailable"}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusDisplay.color }]}>
              <Text style={styles.statusBadgeText}>{statusDisplay.label}</Text>
            </View>
          </View>

          {plant.location ? (
            <Text style={styles.locationTag}>{plant.location}</Text>
          ) : null}

          <PlantWeatherNote onTaskAdjusted={loadPlant} plantId={plant.id} />

          <QuickLogPanel
            confirmedAction={confirmedAction}
            noteText={noteText}
            onChangeNote={setNoteText}
            onLog={logCareAction}
            pendingAction={pendingAction}
          />

          {careMessage ? <Text style={styles.careMessage}>{careMessage}</Text> : null}

          <Pressable
            accessibilityLabel="View care guide"
            accessibilityRole="button"
            disabled={!plant.speciesId}
            style={[styles.guideButton, !plant.speciesId ? styles.disabledButton : null]}
            onPress={() =>
              plant.speciesId
                ? router.push({
                    pathname: "/(auth)/species/[speciesId]" as never,
                    params: { speciesId: plant.speciesId }
                  })
                : undefined
            }
          >
            <MaterialCommunityIcons
              color={theme.colors.forest}
              name="book-open-page-variant-outline"
              size={22}
            />
            <Text style={styles.guideButtonText}>View care guide</Text>
          </Pressable>

          <Pressable
            accessibilityLabel={`Diagnose ${plant.displayName}`}
            accessibilityRole="button"
            style={styles.diagnoseButton}
            onPress={() =>
              router.push({
                pathname: "/(auth)/(tabs)/scan" as never,
                params: {
                  mode: "diagnose",
                  plantId: plant.id
                }
              })
            }
          >
            <MaterialCommunityIcons
              color={theme.colors.white}
              name="stethoscope"
              size={22}
            />
            <Text style={styles.diagnoseButtonText}>Diagnose plant</Text>
          </Pressable>

          <CareScheduleSection
            careError={loadState.careError}
            editingTaskId={editingTaskId}
            onCancelEdit={() => setEditingTaskId(null)}
            onChangeDraft={(taskId, value) =>
              setTaskDrafts((current) => ({ ...current, [taskId]: value }))
            }
            onRetry={loadPlant}
            onSaveTask={saveTask}
            onStartEdit={startTaskEdit}
            onToggleTask={toggleTask}
            savingTaskId={savingTaskId}
            taskDrafts={taskDrafts}
            tasks={loadState.tasks}
          />
          {growthLimitMessage ? (
            <UpgradePrompt
              analyticsSource="growth_timeline_limit"
              message={growthLimitMessage}
              onDismiss={() => setGrowthLimitMessage(null)}
              style={styles.growthLimitPrompt}
              title="Growth timeline limit"
            />
          ) : null}
          <GrowthTimelineSection
            error={loadState.growthError}
            noteText={growthNote}
            onChangeNote={setGrowthNote}
            onChoosePhoto={() => addGrowthPhotoFrom("library")}
            onOpenPhoto={setSelectedGrowthPhoto}
            onRetry={loadPlant}
            onTakePhoto={() => addGrowthPhotoFrom("camera")}
            pendingSource={pendingGrowthSource}
            photos={loadState.growthPhotos}
          />
          <CareHistorySection logs={loadState.logs} />
          <DiagnosisHistorySection
            diagnoses={loadState.diagnoses}
            error={loadState.diagnosisError}
            expandedDiagnosisId={expandedDiagnosisId}
            onRetry={loadPlant}
            onToggle={toggleDiagnosis}
          />

          {isEditing ? (
            <View style={styles.editPanel}>
              <Text style={styles.sectionTitle}>Edit plant</Text>
              <Text style={styles.label}>Nickname</Text>
              <TextInput
                maxLength={40}
                onChangeText={setNickname}
                placeholder={plant.species?.commonName ?? "Plant nickname"}
                placeholderTextColor={theme.colors.moss}
                style={styles.input}
                value={nickname}
              />
              <Text style={styles.label}>Location</Text>
              <TextInput
                maxLength={40}
                onChangeText={setLocation}
                placeholder="Location"
                placeholderTextColor={theme.colors.moss}
                style={styles.input}
                value={location}
              />
              <PlantEnvironmentFields
                lightExposure={lightExposure}
                onChangeLightExposure={setLightExposure}
                onChangePlacement={setPlacement}
                placement={placement}
              />
              <Text style={styles.label}>Status</Text>
              <View style={styles.statusOptions}>
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
              <View style={styles.photoActions}>
                <Pressable
                  accessibilityLabel="Take a replacement plant photo"
                  accessibilityRole="button"
                  style={styles.secondaryButton}
                  onPress={takeReplacementPhoto}
                >
                  <Text style={styles.secondaryButtonText}>Take photo</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Choose a replacement plant photo"
                  accessibilityRole="button"
                  style={styles.secondaryButton}
                  onPress={chooseReplacementPhoto}
                >
                  <Text style={styles.secondaryButtonText}>Choose photo</Text>
                </Pressable>
              </View>
              {message ? <Text style={styles.message}>{message}</Text> : null}
              <View style={styles.editActions}>
                <Pressable
                  accessibilityLabel="Cancel plant edits"
                  accessibilityRole="button"
                  style={styles.secondaryButton}
                  onPress={() => {
                    setIsEditing(false);
                    setReplacementPhotoUri(null);
                    setNickname(plant.nickname ?? "");
                    setLocation(plant.location ?? "");
                    setPlacement(plant.placement);
                    setLightExposure(plant.lightExposure);
                    setStatus(plant.status);
                    setMessage(null);
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Save plant changes"
                  accessibilityRole="button"
                  disabled={isSaving}
                  style={[styles.primaryButton, isSaving ? styles.disabledButton : null]}
                  onPress={saveChanges}
                >
                  {isSaving ? (
                    <ActivityIndicator color={theme.colors.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save changes</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {message ? <Text style={styles.message}>{message}</Text> : null}
              <View style={styles.manageActions}>
                <Pressable
                  accessibilityLabel="Edit plant"
                  accessibilityRole="button"
                  style={styles.primaryButton}
                  onPress={() => setIsEditing(true)}
                >
                  <Text style={styles.primaryButtonText}>Edit plant</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Delete ${plant.displayName}`}
                  accessibilityRole="button"
                  style={styles.deleteButton}
                  onPress={confirmDelete}
                >
                  <Text style={styles.deleteButtonText}>Delete plant</Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
        <GrowthPhotoViewer
          onClose={() => setSelectedGrowthPhoto(null)}
          photo={selectedGrowthPhoto}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function QuickLogPanel({
  confirmedAction,
  noteText,
  onChangeNote,
  onLog,
  pendingAction
}: {
  confirmedAction: CareLogType | null;
  noteText: string;
  onChangeNote: (value: string) => void;
  onLog: (type: CareLogType) => void;
  pendingAction: CareLogType | null;
}) {
  return (
    <View style={styles.quickPanel}>
      <Text style={styles.sectionTitle}>Quick log</Text>
      <TextInput
        multiline
        onChangeText={onChangeNote}
        placeholder="Optional care note"
        placeholderTextColor={theme.colors.moss}
        style={[styles.input, styles.noteInput]}
        value={noteText}
      />
      <View style={styles.quickActions}>
        {QUICK_LOG_ACTIONS.map((action) => {
          const isPending = pendingAction === action;
          const isConfirmed = confirmedAction === action;
          const disabled =
            Boolean(pendingAction) || (action === "note" && !noteText.trim());

          return (
            <Pressable
              accessibilityLabel={`Log ${formatCareType(action)}`}
              accessibilityRole="button"
              disabled={disabled}
              key={action}
              onPress={() => onLog(action)}
              style={[styles.quickAction, disabled ? styles.disabledButton : null]}
            >
              {isPending ? (
                <ActivityIndicator color={theme.colors.forest} />
              ) : (
                <MaterialCommunityIcons
                  color={isConfirmed ? theme.colors.leaf : theme.colors.moss}
                  name={isConfirmed ? "check-circle-outline" : getCareIcon(action)}
                  size={22}
                />
              )}
              <Text style={styles.quickActionText}>{formatCareType(action)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function CareScheduleSection({
  careError,
  editingTaskId,
  onCancelEdit,
  onChangeDraft,
  onRetry,
  onSaveTask,
  onStartEdit,
  onToggleTask,
  savingTaskId,
  taskDrafts,
  tasks
}: {
  careError: string | null;
  editingTaskId: string | null;
  onCancelEdit: () => void;
  onChangeDraft: (taskId: string, value: string) => void;
  onRetry: () => void;
  onSaveTask: (task: CareTask) => void;
  onStartEdit: (task: CareTask) => void;
  onToggleTask: (task: CareTask) => void;
  savingTaskId: string | null;
  taskDrafts: Record<string, string>;
  tasks: CareTask[];
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Care schedule</Text>
        <Pressable
          accessibilityLabel="Refresh care schedule"
          accessibilityRole="button"
          style={styles.iconButton}
          onPress={onRetry}
        >
          <MaterialCommunityIcons color={theme.colors.forest} name="refresh" size={20} />
        </Pressable>
      </View>

      {careError ? (
        <View style={styles.inlineNotice}>
          <Text style={styles.inlineNoticeText}>{careError}</Text>
          <Pressable
            accessibilityLabel="Retry loading care schedule"
            accessibilityRole="button"
            style={styles.noticeButton}
            onPress={onRetry}
          >
            <Text style={styles.noticeButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {tasks.length === 0 ? (
        <View style={styles.emptyBlock}>
          <Text style={styles.bodyText}>No care tasks yet.</Text>
          <Pressable
            accessibilityLabel="Create care schedule"
            accessibilityRole="button"
            style={styles.noticeButton}
            onPress={onRetry}
          >
            <Text style={styles.noticeButtonText}>Create schedule</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.taskList}>
          {tasks.map((task) => (
            <CareTaskRow
              draftValue={taskDrafts[task.id] ?? String(task.intervalDays)}
              editing={editingTaskId === task.id}
              key={task.id}
              onCancelEdit={onCancelEdit}
              onChangeDraft={(value) => onChangeDraft(task.id, value)}
              onSave={() => onSaveTask(task)}
              onStartEdit={() => onStartEdit(task)}
              onToggle={() => onToggleTask(task)}
              saving={savingTaskId === task.id}
              task={task}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function CareTaskRow({
  draftValue,
  editing,
  onCancelEdit,
  onChangeDraft,
  onSave,
  onStartEdit,
  onToggle,
  saving,
  task
}: {
  draftValue: string;
  editing: boolean;
  onCancelEdit: () => void;
  onChangeDraft: (value: string) => void;
  onSave: () => void;
  onStartEdit: () => void;
  onToggle: () => void;
  saving: boolean;
  task: CareTask;
}) {
  const dueStyle = getDueStyle(task);

  return (
    <View style={[styles.taskRow, !task.isActive ? styles.taskRowInactive : null]}>
      <View style={[styles.taskIcon, { backgroundColor: dueStyle.backgroundColor }]}>
        <MaterialCommunityIcons color={dueStyle.color} name={getCareIcon(task.type)} size={22} />
      </View>
      <View style={styles.taskBody}>
        <View style={styles.taskTitleRow}>
          <Text style={styles.taskTitle}>{formatCareType(task.type)}</Text>
          <Text style={[styles.dueBadge, { color: dueStyle.color }]}>
            {getDueLabel(task)}
          </Text>
        </View>
        <Text style={styles.taskMeta}>
          Every {task.intervalDays} {task.intervalDays === 1 ? "day" : "days"} -
          next {formatDateOnly(task.nextDueDate)}
        </Text>
        {editing ? (
          <View style={styles.taskEditRow}>
            <TextInput
              keyboardType="number-pad"
              maxLength={3}
              onChangeText={onChangeDraft}
              placeholder="Days"
              placeholderTextColor={theme.colors.moss}
              style={[styles.input, styles.intervalInput]}
              value={draftValue}
            />
            <Pressable
              accessibilityLabel="Cancel task interval edit"
              accessibilityRole="button"
              style={styles.smallSecondaryButton}
              onPress={onCancelEdit}
            >
              <Text style={styles.smallSecondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Save care task interval"
              accessibilityRole="button"
              disabled={saving}
              style={[styles.smallPrimaryButton, saving ? styles.disabledButton : null]}
              onPress={onSave}
            >
              {saving ? (
                <ActivityIndicator color={theme.colors.white} size="small" />
              ) : (
                <Text style={styles.smallPrimaryButtonText}>Save</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.taskActions}>
            <Pressable
              accessibilityLabel={`Edit ${formatCareType(task.type)} schedule`}
              accessibilityRole="button"
              style={styles.textActionButton}
              onPress={onStartEdit}
            >
              <Text style={styles.textAction}>Edit</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`${task.isActive ? "Pause" : "Resume"} ${formatCareType(
                task.type
              )} schedule`}
              accessibilityRole="button"
              disabled={saving}
              style={styles.textActionButton}
              onPress={onToggle}
            >
              <Text style={styles.textAction}>{task.isActive ? "Pause" : "Resume"}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function GrowthTimelineSection({
  error,
  noteText,
  onChangeNote,
  onChoosePhoto,
  onOpenPhoto,
  onRetry,
  onTakePhoto,
  pendingSource,
  photos
}: {
  error: string | null;
  noteText: string;
  onChangeNote: (value: string) => void;
  onChoosePhoto: () => void;
  onOpenPhoto: (photo: GrowthPhoto) => void;
  onRetry: () => void;
  onTakePhoto: () => void;
  pendingSource: "camera" | "library" | null;
  photos: GrowthPhoto[];
}) {
  const [failedPhotoIds, setFailedPhotoIds] = useState<Record<string, true>>({});
  const hasPhotos = photos.length > 0;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Growth timeline</Text>
        <Pressable
          accessibilityLabel="Refresh growth timeline"
          accessibilityRole="button"
          style={styles.iconButton}
          onPress={onRetry}
        >
          <MaterialCommunityIcons color={theme.colors.forest} name="refresh" size={20} />
        </Pressable>
      </View>

      {error ? (
        <View style={styles.inlineNotice}>
          <Text style={styles.inlineNoticeText}>{error}</Text>
          <Pressable
            accessibilityLabel="Retry loading growth timeline"
            accessibilityRole="button"
            style={styles.noticeButton}
            onPress={onRetry}
          >
            <Text style={styles.noticeButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.growthAddPanel}>
        <TextInput
          multiline
          onChangeText={onChangeNote}
          placeholder="Optional growth note"
          placeholderTextColor={theme.colors.moss}
          style={[styles.input, styles.growthNoteInput]}
          value={noteText}
        />
        <View style={styles.growthActions}>
          <GrowthPhotoActionButton
            disabled={Boolean(pendingSource)}
            icon="camera-plus-outline"
            label="Add growth photo"
            loading={pendingSource === "camera"}
            onPress={onTakePhoto}
          />
          <GrowthPhotoActionButton
            disabled={Boolean(pendingSource)}
            icon="image-plus"
            label="Choose photo"
            loading={pendingSource === "library"}
            onPress={onChoosePhoto}
          />
        </View>
      </View>

      {hasPhotos ? (
        <ScrollView
          contentContainerStyle={styles.timelineRail}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {photos.map((photo) => {
            const failed = failedPhotoIds[photo.id];

            return (
              <Pressable
                accessibilityLabel={`Open growth photo from ${formatDateTime(
                  photo.loggedAt
                )}`}
                accessibilityRole="imagebutton"
                key={photo.id}
                onPress={() => onOpenPhoto(photo)}
                style={styles.timelineCard}
              >
                {failed ? (
                  <View style={styles.timelineImageFallback}>
                    <MaterialCommunityIcons
                      color={theme.colors.leaf}
                      name="image-off-outline"
                      size={30}
                    />
                  </View>
                ) : (
                  <Image
                    onError={() =>
                      setFailedPhotoIds((current) => ({
                        ...current,
                        [photo.id]: true
                      }))
                    }
                    source={{ uri: photo.photoUrl }}
                    style={styles.timelineImage}
                  />
                )}
                <View style={styles.timelineCopy}>
                  <Text style={styles.timelineDate}>
                    {formatDateTime(photo.loggedAt)}
                  </Text>
                  {photo.note ? (
                    <Text numberOfLines={2} style={styles.timelineNote}>
                      {photo.note}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.emptyBlock}>
          <Text style={styles.bodyText}>
            Add a photo to start tracking visible growth.
          </Text>
        </View>
      )}
    </View>
  );
}

function GrowthPhotoActionButton({
  disabled,
  icon,
  label,
  loading,
  onPress
}: {
  disabled: boolean;
  icon: IconName;
  label: string;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.growthActionButton, disabled ? styles.disabledButton : null]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.forest} />
      ) : (
        <MaterialCommunityIcons color={theme.colors.forest} name={icon} size={22} />
      )}
      <Text style={styles.growthActionText}>{label}</Text>
    </Pressable>
  );
}

function GrowthPhotoViewer({
  onClose,
  photo
}: {
  onClose: () => void;
  photo: GrowthPhoto | null;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [photo?.id]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={Boolean(photo)}
    >
      <View style={styles.photoViewerBackdrop}>
        <Pressable
          accessibilityLabel="Close growth photo"
          accessibilityRole="button"
          style={styles.photoViewerClose}
          onPress={onClose}
        >
          <MaterialCommunityIcons color={theme.colors.white} name="close" size={24} />
        </Pressable>
        {photo && !failed ? (
          <Image
            onError={() => setFailed(true)}
            resizeMode="contain"
            source={{ uri: photo.photoUrl }}
            style={styles.photoViewerImage}
          />
        ) : (
          <View style={styles.photoViewerFallback}>
            <MaterialCommunityIcons
              color={theme.colors.white}
              name="image-off-outline"
              size={46}
            />
            <Text style={styles.photoViewerFallbackText}>
              This photo could not be loaded.
            </Text>
          </View>
        )}
        {photo ? (
          <View style={styles.photoViewerCaption}>
            <Text style={styles.photoViewerDate}>{formatDateTime(photo.loggedAt)}</Text>
            {photo.note ? (
              <Text style={styles.photoViewerNote}>{photo.note}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function CareHistorySection({ logs }: { logs: CareLog[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Care history</Text>
      {logs.length === 0 ? (
        <Text style={styles.bodyText}>
          Log your first care action from the quick log above.
        </Text>
      ) : (
        <View style={styles.historyList}>
          {groupLogsByDate(logs).map((group) => (
            <View key={group.key} style={styles.historyGroup}>
              <Text style={styles.historyDate}>{group.label}</Text>
              {group.logs.map((log) => (
                <View key={log.id} style={styles.logRow}>
                  <View style={styles.logIcon}>
                    <MaterialCommunityIcons
                      color={theme.colors.forest}
                      name={getCareIcon(log.type)}
                      size={20}
                    />
                  </View>
                  <View style={styles.logBody}>
                    <Text style={styles.logTitle}>{formatCareType(log.type)}</Text>
                    <Text style={styles.logTime}>{formatTime(log.loggedAt)}</Text>
                    {log.note ? <Text style={styles.logNote}>{log.note}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function DiagnosisHistorySection({
  diagnoses,
  error,
  expandedDiagnosisId,
  onRetry,
  onToggle
}: {
  diagnoses: SavedDiagnosis[];
  error: string | null;
  expandedDiagnosisId: string | null;
  onRetry: () => void;
  onToggle: (diagnosisId: string) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Diagnosis history</Text>
        <Pressable
          accessibilityLabel="Refresh diagnosis history"
          accessibilityRole="button"
          style={styles.iconButton}
          onPress={onRetry}
        >
          <MaterialCommunityIcons color={theme.colors.forest} name="refresh" size={20} />
        </Pressable>
      </View>

      {error ? (
        <View style={styles.inlineNotice}>
          <Text style={styles.inlineNoticeText}>{error}</Text>
          <Pressable
            accessibilityLabel="Retry loading diagnosis history"
            accessibilityRole="button"
            style={styles.noticeButton}
            onPress={onRetry}
          >
            <Text style={styles.noticeButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {diagnoses.length === 0 ? (
        <Text style={styles.bodyText}>No diagnoses yet.</Text>
      ) : (
        <View style={styles.historyList}>
          {diagnoses.map((diagnosis) => {
            const expanded = expandedDiagnosisId === diagnosis.id;
            const severity = getDiagnosisSeverityDisplay(
              diagnosis.severity,
              diagnosis.isHealthy
            );

            return (
              <Pressable
                accessibilityLabel={`${expanded ? "Collapse" : "Expand"} diagnosis ${
                  diagnosis.conditionName
                }`}
                accessibilityRole="button"
                key={diagnosis.id}
                onPress={() => onToggle(diagnosis.id)}
                style={styles.diagnosisRow}
              >
                <View style={styles.diagnosisHeader}>
                  <View style={styles.diagnosisTitleText}>
                    <Text style={styles.logTitle}>{diagnosis.conditionName}</Text>
                    <Text style={styles.logTime}>
                      {formatDateTime(diagnosis.createdAt)}
                    </Text>
                  </View>
                  <View style={[styles.miniBadge, { backgroundColor: severity.color }]}>
                    <Text style={styles.miniBadgeText}>{severity.label}</Text>
                  </View>
                </View>
                {diagnosis.followUpDate ? (
                  <Text style={styles.taskMeta}>
                    Follow-up {formatDateOnly(diagnosis.followUpDate)}
                  </Text>
                ) : null}
                {expanded ? (
                  <View style={styles.diagnosisDetails}>
                    {diagnosis.cause ? (
                      <Text style={styles.logNote}>{diagnosis.cause}</Text>
                    ) : null}
                    {diagnosis.treatmentSteps.map((step, index) => (
                      <Text key={`${diagnosis.id}-step-${index}`} style={styles.logNote}>
                        {index + 1}. {step}
                      </Text>
                    ))}
                    {diagnosis.prevention ? (
                      <Text style={styles.logNote}>Prevention: {diagnosis.prevention}</Text>
                    ) : null}
                    <Text style={styles.diagnosisDisclaimer}>
                      {DIAGNOSIS_ADVISORY}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function PlaceholderSection({ body, title }: { body: string; title: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.bodyText}>{body}</Text>
    </View>
  );
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
    <Pressable
      accessibilityLabel={`Set plant status to ${label}`}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.statusOption, active ? styles.statusOptionActive : null]}
    >
      <Text
        style={[
          styles.statusOptionText,
          active ? styles.statusOptionTextActive : null
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function buildTaskDrafts(tasks: CareTask[]) {
  return Object.fromEntries(
    tasks.map((task) => [task.id, String(task.intervalDays)])
  );
}

function getCareIcon(type: CareLogType | CareTaskType): IconName {
  switch (type) {
    case "water":
      return "water-outline";
    case "fertilize":
      return "leaf";
    case "repot":
      return "sprout";
    case "prune":
      return "content-cut";
    case "rotate":
      return "rotate-3d-variant";
    case "mist":
      return "weather-fog";
    case "check_diagnosis":
      return "clipboard-pulse-outline";
    case "note":
      return "note-outline";
    case "growth_photo":
      return "image-multiple-outline";
  }
}

function getDueStyle(task: CareTask) {
  if (!task.isActive) {
    return {
      backgroundColor: theme.colors.leafMuted,
      color: theme.colors.moss
    };
  }

  if (task.dueState === "overdue") {
    return {
      backgroundColor: theme.colors.blush,
      color: theme.colors.terra
    };
  }

  if (task.dueState === "due_tomorrow") {
    return {
      backgroundColor: theme.colors.honey,
      color: theme.colors.ochre
    };
  }

  return {
    backgroundColor: theme.colors.leafMuted,
    color: theme.colors.leaf
  };
}

function getDueLabel(task: CareTask) {
  if (!task.isActive) {
    return "Paused";
  }

  if (task.daysUntilDue < 0) {
    const days = Math.abs(task.daysUntilDue);

    return `Overdue ${days} ${days === 1 ? "day" : "days"}`;
  }

  if (task.daysUntilDue === 0) {
    return "Due today";
  }

  if (task.daysUntilDue === 1) {
    return "Due tomorrow";
  }

  return `Due in ${task.daysUntilDue} days`;
}

function formatDateOnly(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function getDiagnosisSeverityDisplay(severity: string, isHealthy: boolean) {
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

function groupLogsByDate(logs: CareLog[]) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const todayKey = dateKey(today);
  const yesterdayKey = dateKey(yesterday);

  return logs.reduce<Array<{ key: string; label: string; logs: CareLog[] }>>(
    (groups, log) => {
      const loggedDate = new Date(log.loggedAt);
      const key = dateKey(loggedDate);
      const existing = groups.find((group) => group.key === key);
      const label =
        key === todayKey
          ? "Today"
          : key === yesterdayKey
            ? "Yesterday"
            : loggedDate.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric"
              });

      if (existing) {
        existing.logs.push(log);
      } else {
        groups.push({ key, label, logs: [log] });
      }

      return groups;
    },
    []
  );
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}

function getStatusDisplay(status: PlantStatus) {
  switch (status) {
    case "needs_attention":
      return { label: "Needs attention", color: theme.colors.ochre };
    case "sick":
      return { label: "Sick", color: theme.colors.terra };
    default:
      return { label: "Healthy", color: theme.colors.leaf };
  }
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.colors.paper,
    flex: 1
  },
  screen: {
    flex: 1
  },
  content: {
    paddingBottom: theme.spacing.xxl
  },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    minHeight: 44,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md
  },
  backText: {
    color: theme.colors.forest,
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bodyBold
  },
  heroImage: {
    height: 320,
    width: "100%"
  },
  heroPlaceholder: {
    alignItems: "center",
    backgroundColor: theme.colors.leafMuted,
    height: 320,
    justifyContent: "center",
    width: "100%"
  },
  titleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.spacing.md,
    padding: theme.spacing.xl
  },
  titleText: {
    flex: 1
  },
  title: {
    color: theme.colors.forest,
    fontSize: theme.typography.display,
    fontFamily: theme.typography.fontFamily.displayBold,
    lineHeight: 40
  },
  subtitle: {
    color: theme.colors.moss,
    fontSize: theme.typography.body,
    lineHeight: 24,
    marginTop: theme.spacing.xs
  },
  statusBadge: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  statusBadgeText: {
    color: theme.colors.white,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bodyBlack
  },
  locationTag: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.leafMuted,
    borderRadius: theme.radius.pill,
    color: theme.colors.forest,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bodyBlack,
    marginHorizontal: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  quickPanel: {
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
    marginTop: theme.spacing.md
  },
  quickAction: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    ...theme.shadow.soft,
    flexBasis: "30%",
    flexGrow: 1,
    minHeight: 74,
    justifyContent: "center"
  },
  quickActionText: {
    color: theme.colors.moss,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bodyBold,
    marginTop: theme.spacing.xs
  },
  guideButton: {
    alignItems: "center",
    backgroundColor: theme.colors.leafMuted,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    ...theme.shadow.soft,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    marginHorizontal: theme.spacing.xl,
    marginTop: theme.spacing.xl,
    minHeight: 54
  },
  guideButtonText: {
    color: theme.colors.forest,
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bodyBlack
  },
  diagnoseButton: {
    alignItems: "center",
    backgroundColor: theme.colors.forest,
    borderRadius: theme.radius.card,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    marginHorizontal: theme.spacing.xl,
    marginTop: theme.spacing.md,
    minHeight: 54
  },
  diagnoseButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bodyBlack
  },
  section: {
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm
  },
  sectionTitle: {
    color: theme.colors.forest,
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.display,
    marginBottom: theme.spacing.sm
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: theme.colors.leafMuted,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    ...theme.shadow.soft,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  bodyText: {
    color: theme.colors.moss,
    fontSize: theme.typography.body,
    lineHeight: 24
  },
  inlineNotice: {
    backgroundColor: theme.colors.blush,
    borderColor: theme.colors.terra,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.md
  },
  inlineNoticeText: {
    color: theme.colors.terra,
    fontSize: theme.typography.body,
    lineHeight: 22
  },
  noticeButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.colors.forest,
    borderRadius: theme.radius.card,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg
  },
  noticeButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bodyBlack
  },
  emptyBlock: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    ...theme.shadow.soft,
    gap: theme.spacing.md,
    padding: theme.spacing.md
  },
  growthAddPanel: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    ...theme.shadow.soft,
    gap: theme.spacing.md,
    padding: theme.spacing.md
  },
  growthNoteInput: {
    minHeight: 64,
    paddingTop: theme.spacing.md,
    textAlignVertical: "top"
  },
  growthActions: {
    flexDirection: "row",
    gap: theme.spacing.md
  },
  growthActionButton: {
    alignItems: "center",
    backgroundColor: theme.colors.leafMuted,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    ...theme.shadow.soft,
    flex: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: theme.spacing.md
  },
  growthActionText: {
    color: theme.colors.forest,
    flexShrink: 1,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bodyBlack,
    textAlign: "center"
  },
  timelineRail: {
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingRight: theme.spacing.xl
  },
  timelineCard: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    ...theme.shadow.soft,
    overflow: "hidden",
    width: 156
  },
  timelineImage: {
    backgroundColor: theme.colors.leafMuted,
    height: 118,
    width: "100%"
  },
  timelineImageFallback: {
    alignItems: "center",
    backgroundColor: theme.colors.leafMuted,
    height: 118,
    justifyContent: "center",
    width: "100%"
  },
  timelineCopy: {
    gap: theme.spacing.xs,
    padding: theme.spacing.md
  },
  timelineDate: {
    color: theme.colors.forest,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bodyBlack
  },
  timelineNote: {
    color: theme.colors.moss,
    fontSize: theme.typography.caption,
    lineHeight: 18
  },
  taskList: {
    gap: theme.spacing.md
  },
  taskRow: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    ...theme.shadow.soft,
    flexDirection: "row",
    gap: theme.spacing.md,
    padding: theme.spacing.md
  },
  taskRowInactive: {
    opacity: 0.72
  },
  taskIcon: {
    alignItems: "center",
    borderRadius: theme.radius.card,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  taskBody: {
    flex: 1
  },
  taskTitleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "space-between"
  },
  taskTitle: {
    color: theme.colors.forest,
    flex: 1,
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bodyBlack
  },
  dueBadge: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bodyBlack,
    textAlign: "right"
  },
  taskMeta: {
    color: theme.colors.moss,
    fontSize: theme.typography.caption,
    lineHeight: 18,
    marginTop: theme.spacing.xs
  },
  taskActions: {
    flexDirection: "row",
    gap: theme.spacing.md,
    marginTop: theme.spacing.md
  },
  textActionButton: {
    minHeight: 36,
    justifyContent: "center"
  },
  textAction: {
    color: theme.colors.forest,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bodyBlack
  },
  taskEditRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md
  },
  intervalInput: {
    flex: 1,
    minHeight: 44
  },
  smallPrimaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.forest,
    borderRadius: theme.radius.card,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 72,
    paddingHorizontal: theme.spacing.md
  },
  smallPrimaryButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bodyBlack
  },
  smallSecondaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.leafMuted,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    ...theme.shadow.soft,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 72,
    paddingHorizontal: theme.spacing.md
  },
  smallSecondaryButtonText: {
    color: theme.colors.forest,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bodyBlack
  },
  historyList: {
    gap: theme.spacing.lg
  },
  historyGroup: {
    gap: theme.spacing.sm
  },
  historyDate: {
    color: theme.colors.forest,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bodyBlack,
    textTransform: "uppercase"
  },
  logRow: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    ...theme.shadow.soft,
    flexDirection: "row",
    gap: theme.spacing.md,
    padding: theme.spacing.md
  },
  logIcon: {
    alignItems: "center",
    backgroundColor: theme.colors.leafMuted,
    borderRadius: theme.radius.card,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  logBody: {
    flex: 1
  },
  logTitle: {
    color: theme.colors.forest,
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bodyBlack
  },
  logTime: {
    color: theme.colors.moss,
    fontSize: theme.typography.caption,
    marginTop: theme.spacing.xs
  },
  logNote: {
    color: theme.colors.ink,
    fontSize: theme.typography.body,
    lineHeight: 22,
    marginTop: theme.spacing.sm
  },
  diagnosisRow: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    ...theme.shadow.soft,
    padding: theme.spacing.md
  },
  diagnosisHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between"
  },
  diagnosisTitleText: {
    flex: 1
  },
  miniBadge: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  miniBadgeText: {
    color: theme.colors.white,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bodyBlack
  },
  diagnosisDetails: {
    borderTopColor: theme.colors.line,
    borderTopWidth: 1,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm
  },
  diagnosisDisclaimer: {
    backgroundColor: theme.colors.blush,
    borderColor: theme.colors.terra,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    color: theme.colors.ink,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bodyBold,
    lineHeight: 18,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md
  },
  editPanel: {
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl
  },
  growthLimitPrompt: {
    marginHorizontal: theme.spacing.xl,
    marginTop: theme.spacing.xl
  },
  label: {
    color: theme.colors.forest,
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bodyBlack,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.lg
  },
  input: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    ...theme.shadow.soft,
    color: theme.colors.ink,
    fontSize: theme.typography.body,
    minHeight: 52,
    paddingHorizontal: theme.spacing.md
  },
  noteInput: {
    minHeight: 80,
    paddingTop: theme.spacing.md,
    textAlignVertical: "top"
  },
  statusOptions: {
    gap: theme.spacing.sm
  },
  statusOption: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    ...theme.shadow.soft,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md
  },
  statusOptionActive: {
    backgroundColor: theme.colors.leafMuted,
    borderColor: theme.colors.leaf
  },
  statusOptionText: {
    color: theme.colors.forest,
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bodyBold
  },
  statusOptionTextActive: {
    color: theme.colors.forest
  },
  photoActions: {
    flexDirection: "row",
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg
  },
  editActions: {
    flexDirection: "row",
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl
  },
  manageActions: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.forest,
    borderRadius: theme.radius.card,
    flex: 1,
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
    flex: 1,
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
  deleteButton: {
    alignItems: "center",
    borderColor: theme.colors.terra,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: theme.spacing.lg
  },
  deleteButtonText: {
    color: theme.colors.terra,
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bodyBlack
  },
  photoViewerBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(18, 23, 17, 0.94)",
    flex: 1,
    justifyContent: "center",
    padding: theme.spacing.lg
  },
  photoViewerClose: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: theme.radius.pill,
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: theme.spacing.lg,
    top: theme.spacing.xl,
    width: 44,
    zIndex: 2
  },
  photoViewerImage: {
    height: "74%",
    width: "100%"
  },
  photoViewerFallback: {
    alignItems: "center",
    gap: theme.spacing.md,
    justifyContent: "center",
    minHeight: 260,
    width: "100%"
  },
  photoViewerFallbackText: {
    color: theme.colors.white,
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bodyBold,
    textAlign: "center"
  },
  photoViewerCaption: {
    alignSelf: "stretch",
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.lg
  },
  photoViewerDate: {
    color: theme.colors.white,
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bodyBlack,
    textAlign: "center"
  },
  photoViewerNote: {
    color: theme.colors.white,
    fontSize: theme.typography.body,
    lineHeight: 22,
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
  careMessage: {
    color: theme.colors.terra,
    fontSize: theme.typography.body,
    lineHeight: 24,
    marginHorizontal: theme.spacing.xl,
    marginTop: theme.spacing.md
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
  },
  stateActions: {
    gap: theme.spacing.md,
    width: "100%"
  }
});
