import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";

import { ScanFrame } from "@/components/illustrations/ScanFrame";
import { PremiumLockedScreen } from "@/components/payments/PremiumLockedScreen";
import { UpgradePrompt } from "@/components/payments/UpgradePrompt";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconChip } from "@/components/ui/IconChip";
import { PressableScale } from "@/components/ui/PressableScale";
import { theme } from "@/constants/theme";
import {
  ANALYTICS_EVENTS,
  trackAction
} from "@/lib/analytics/firebaseAnalytics";
import { getCameraPermissionPromptCopy } from "@/lib/cameraPermissionPrompt";
import {
  diagnosePlantPhoto,
  fetchDiagnosisSpeciesContext
} from "@/lib/api/diagnosis";
import { identifyPlant } from "@/lib/api/identifyPlant";
import { createDiagnosisDraft } from "@/lib/diagnosisDraftStore";
import {
  checkDiagnoseScanAllowance,
  checkIdentifyScanAllowance
} from "@/lib/payments/limits";
import { useEntitlement } from "@/providers/EntitlementProvider";
import { usePendingScan, type PendingScanPhoto } from "@/providers/PendingScanProvider";
import type {
  IdentifyPlantResult,
  PlantIdentificationCandidate,
  PlantIdentificationResult
} from "@/types/identifyPlant";

type CapturedPhoto = {
  source: "camera" | "library";
  uri: string;
  width?: number;
  height?: number;
};

type ScanStep = "camera" | "preview" | "loading" | "result" | "error" | "limit";
type ScanMode = "identify" | "diagnose";

const MAX_IMAGE_EDGE = 1024;

export default function ScanScreen() {
  const params = useLocalSearchParams<{
    mode?: string | string[];
    plantId?: string | string[];
    resumePending?: string | string[];
  }>();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const hasResumedPendingRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScanMode>(getInitialMode(params.mode));
  const [sourcePlantId, setSourcePlantId] = useState<string | null>(
    getStringParam(params.plantId)
  );
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [step, setStep] = useState<ScanStep>("camera");
  const [result, setResult] = useState<IdentifyPlantResult | null>(null);
  const [selectedAlternateIndex, setSelectedAlternateIndex] = useState<number | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [limitTitle, setLimitTitle] = useState<string | null>(null);
  const { isPremium } = useEntitlement();
  const pendingScan = usePendingScan();
  const cameraPermissionPrompt = getCameraPermissionPromptCopy();

  useEffect(() => {
    const nextMode = getInitialMode(params.mode);
    const nextPlantId = getStringParam(params.plantId);

    setMode(nextMode);
    setSourcePlantId(nextPlantId);
  }, [params.mode, params.plantId]);

  useEffect(() => {
    if (
      hasResumedPendingRef.current ||
      !isPremium ||
      getStringParam(params.resumePending) !== "1"
    ) return;

    hasResumedPendingRef.current = true;
    const pending = pendingScan.consume();

    if (!pending) {
      setErrorMessage("The captured photo is no longer available. Please take it again.");
      setStep("camera");
      return;
    }

    setPhoto(pending);
    void submitPhoto(pending);
  }, [isPremium, params.resumePending, pendingScan]);

  const visibleResult = useMemo(() => {
    if (!result?.isPlant) {
      return result;
    }

    if (selectedAlternateIndex === null) {
      return result;
    }

    const alternate = result.alternates[selectedAlternateIndex];

    if (!alternate) {
      return result;
    }

    return {
      ...result,
      primary: {
        ...alternate,
        description:
          alternate.description ??
          "This alternate is visually similar. Compare leaf shape, growth habit, and markings before saving."
      }
    } satisfies PlantIdentificationResult;
  }, [result, selectedAlternateIndex]);

  function changeMode(nextMode: ScanMode) {
    if (step !== "camera") {
      return;
    }

    setMode(nextMode);
    setErrorMessage(null);
    void trackAction(ANALYTICS_EVENTS.SCAN_MODE_CHANGE, {
      from_mode: mode,
      to_mode: nextMode
    });
  }

  async function capturePhoto() {
    setErrorMessage(null);

    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();

      void trackAction(ANALYTICS_EVENTS.CAMERA_PERMISSION_RESULT, {
        result: permission.granted ? "granted" : "denied",
        source: "scan"
      });

      if (!permission.granted) {
        setErrorMessage("Camera access is needed to take a plant photo.");
        return;
      }
    }

    const captured = await cameraRef.current?.takePictureAsync({
      quality: 1,
      skipProcessing: false
    });

    if (!captured?.uri) {
      void trackAction(ANALYTICS_EVENTS.PHOTO_CAPTURE, {
        mode,
        reason: "missing_photo",
        result: "failure"
      });
      setErrorMessage("The camera could not capture a photo. Please try again.");
      return;
    }

    void trackAction(ANALYTICS_EVENTS.PHOTO_CAPTURE, {
      mode,
      result: "success"
    });
    setPhoto({
      source: "camera",
      uri: captured.uri,
      width: captured.width,
      height: captured.height
    });
    setStep("preview");
  }

  async function pickPhoto() {
    setErrorMessage(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    void trackAction(ANALYTICS_EVENTS.LIBRARY_PERMISSION_RESULT, {
      result: permission.granted ? "granted" : "denied",
      source: "scan"
    });

    if (!permission.granted) {
      setErrorMessage("Photo library access is needed to choose an image.");
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      base64: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1
    });

    if (picked.canceled) {
      void trackAction(ANALYTICS_EVENTS.PHOTO_PICK, {
        mode,
        result: "cancelled"
      });
      return;
    }

    const asset = picked.assets[0];

    if (!asset?.uri) {
      void trackAction(ANALYTICS_EVENTS.PHOTO_PICK, {
        mode,
        reason: "missing_photo",
        result: "failure"
      });
      setErrorMessage("That image could not be loaded. Please choose another.");
      return;
    }

    void trackAction(ANALYTICS_EVENTS.PHOTO_PICK, {
      mode,
      result: "success"
    });
    setPhoto({
      source: "library",
      uri: asset.uri,
      width: asset.width,
      height: asset.height
    });
    setStep("preview");
  }

  async function submitPhoto(photoOverride?: PendingScanPhoto) {
    const submittedPhoto = photoOverride ?? photo;

    if (!submittedPhoto) {
      return;
    }

    if (mode === "identify" && !isPremium) {
      pendingScan.preserve(submittedPhoto);
      void trackAction(ANALYTICS_EVENTS.PREMIUM_CTA, {
        source: "captured_photo"
      });
      router.push({
        pathname: "/(auth)/premium" as never,
        params: { source: "captured_photo" }
      });
      return;
    }

    setStep("loading");
    setErrorMessage(null);
    setLimitMessage(null);
    setLimitTitle(null);
    setResult(null);
    setSelectedAlternateIndex(null);
    void trackAction(ANALYTICS_EVENTS.SCAN_SUBMIT, {
      has_plant_context: Boolean(sourcePlantId),
      mode,
      photo_source: submittedPhoto.source
    });

    // Friendly pre-check; the identify-plant function enforces the same caps
    // server-side, so this only exists to avoid a wasted upload.
    const allowance =
      mode === "identify"
        ? await checkIdentifyScanAllowance(isPremium)
        : await checkDiagnoseScanAllowance(isPremium);

    if (!allowance.allowed) {
      void trackAction(ANALYTICS_EVENTS.FREE_LIMIT_HIT, {
        mode,
        stage: "precheck"
      });
      setLimitMessage(allowance.message);
      setLimitTitle(mode === "diagnose" ? "Premium required" : null);
      setStep("limit");
      return;
    }

    try {
      const compressed = await compressPhoto(submittedPhoto);

      if (mode === "identify") {
        const response = await identifyPlant({
          imageBase64: compressed.base64,
          imageMimeType: "image/jpeg",
          scanType: "identify",
          clientRequestId: `${Date.now()}`
        });

        if (!response.ok) {
          if (
            response.error.code === "free_limit_reached" ||
            response.error.code === "premium_required"
          ) {
            void trackAction(ANALYTICS_EVENTS.FREE_LIMIT_HIT, {
              mode,
              reason: response.error.code,
              stage: "server"
            });
            setLimitMessage(response.error.message);
            setLimitTitle(
              response.error.code === "premium_required" ? "Premium required" : null
            );
            setStep("limit");
            return;
          }

          void trackAction(ANALYTICS_EVENTS.IDENTIFY_RESULT, {
            reason: response.error.code,
            result: "failure"
          });
          setErrorMessage(getScanErrorMessage(response.error.message, mode));
          setStep("error");
          return;
        }

        if (response.data.scanType !== "identify") {
          void trackAction(ANALYTICS_EVENTS.IDENTIFY_RESULT, {
            reason: "invalid_scan_type",
            result: "failure"
          });
          setErrorMessage("Identification result could not be read.");
          setStep("error");
          return;
        }

        void trackAction(ANALYTICS_EVENTS.IDENTIFY_RESULT, {
          has_species_profile:
            response.data.result.isPlant && Boolean(response.data.result.speciesId),
          is_plant: response.data.result.isPlant,
          result: "success"
        });
        setResult(response.data.result);
        setStep("result");
        return;
      }

      const contextResult = await fetchDiagnosisSpeciesContext(sourcePlantId);

      if (!contextResult.ok) {
        void trackAction(ANALYTICS_EVENTS.DIAGNOSE_RESULT, {
          reason: contextResult.code,
          result: "failure",
          stage: "context"
        });
        setErrorMessage(contextResult.message);
        setStep("error");
        return;
      }

      const response = await diagnosePlantPhoto({
        imageBase64: compressed.base64,
        speciesContext: contextResult.data,
        clientRequestId: `${Date.now()}`
      });

      if (!response.ok) {
        if (
          response.code === "free_limit_reached" ||
          response.code === "premium_required"
        ) {
          void trackAction(ANALYTICS_EVENTS.FREE_LIMIT_HIT, {
            mode,
            reason: response.code,
            stage: "server"
          });
          setLimitMessage(response.message);
          setLimitTitle(
            response.code === "premium_required" ? "Premium required" : null
          );
          setStep("limit");
          return;
        }

        void trackAction(ANALYTICS_EVENTS.DIAGNOSE_RESULT, {
          reason: response.code,
          result: "failure",
          stage: "diagnose"
        });
        setErrorMessage(getScanErrorMessage(response.message, mode));
        setStep("error");
        return;
      }

      void trackAction(ANALYTICS_EVENTS.DIAGNOSE_RESULT, {
        result: "success"
      });
      const draft = createDiagnosisDraft({
        photoUri: compressed.uri,
        result: response.data.result,
        sourcePlantId: contextResult.data?.userPlantId ?? sourcePlantId,
        sourcePlantName: contextResult.data?.plantName ?? null
      });

      router.push({
        pathname: "/(auth)/diagnosis/[draftId]" as never,
        params: { draftId: draft.id }
      });
    } catch (error) {
      void trackAction(
        mode === "identify"
          ? ANALYTICS_EVENTS.IDENTIFY_RESULT
          : ANALYTICS_EVENTS.DIAGNOSE_RESULT,
        {
          reason: getScanFailureReason(error),
          result: "failure"
        }
      );
      setErrorMessage(getScanErrorMessage(error, mode));
      setStep("error");
    }
  }

  function resetScan() {
    if (step !== "camera" || photo || result || errorMessage || limitMessage) {
      void trackAction(ANALYTICS_EVENTS.SCAN_AGAIN, {
        from_step: step,
        mode
      });
    }
    setPhoto(null);
    setResult(null);
    setSelectedAlternateIndex(null);
    setErrorMessage(null);
    setLimitMessage(null);
    setLimitTitle(null);
    setStep("camera");
  }

  const copy = getModeCopy(mode, Boolean(sourcePlantId));

  if (mode === "diagnose" && !isPremium) {
    return (
      <PremiumLockedScreen
        title="Diagnosis requires Premium"
        message="Plant identification and disease or pest diagnosis require Premium. Start a trial or subscribe before any photo is uploaded."
        secondaryLabel="Identify instead"
        onSecondaryPress={() => {
          void trackAction(ANALYTICS_EVENTS.SCAN_MODE_CHANGE, {
            from_mode: "diagnose",
            source: "premium_locked",
            to_mode: "identify"
          });
          setMode("identify");
        }}
      />
    );
  }

  if (step === "preview" && photo) {
    return (
      <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
        <View style={styles.previewShell}>
          <Image source={{ uri: photo.uri }} style={styles.previewImage} />
          <View style={styles.previewPanel}>
            <View style={styles.previewActions}>
              <Button
                accessibilityLabel="Retake plant photo"
                fullWidth={false}
                icon="camera-retake-outline"
                label="Retake"
                onPress={resetScan}
                style={styles.previewButton}
                variant="secondary"
              />
              <Button
                accessibilityLabel={copy.submitLabel}
                fullWidth={false}
                gradient
                icon="arrow-right"
                iconPosition="trailing"
                label={copy.submitLabel}
                onPress={submitPhoto}
                style={styles.previewButton}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (step === "loading" && photo) {
    return (
      <View style={styles.loadingShell}>
        <Image source={{ uri: photo.uri }} style={styles.loadingImage} blurRadius={8} />
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBadge}>
            <LeafProcessingMark />
            <Text style={styles.loadingTitle}>{copy.loadingTitle}</Text>
            <Text style={styles.loadingText}>{copy.loadingText}</Text>
          </View>
        </View>
      </View>
    );
  }

  if (step === "limit" && photo) {
    return (
      <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.resultContent}
          showsVerticalScrollIndicator={false}
        >
          <Image source={{ uri: photo.uri }} style={styles.resultPhoto} />
          <View style={styles.resultPanel}>
            <UpgradePrompt
              analyticsSource="scan_limit"
              title={limitTitle ?? undefined}
              message={
                limitMessage ??
                "Start a trial or subscribe to Premium to continue scanning."
              }
              onDismiss={resetScan}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if ((step === "result" || step === "error") && photo) {
    return (
      <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.resultContent}
          showsVerticalScrollIndicator={false}
        >
          <Image source={{ uri: photo.uri }} style={styles.resultPhoto} />
          {step === "error" ? (
            <MessageState
              title={mode === "identify" ? "Identification paused" : "Diagnosis paused"}
              body={errorMessage ?? copy.errorFallback}
              onRetry={submitPhoto}
              onScanAgain={resetScan}
            />
          ) : visibleResult?.isPlant === false ? (
            <MessageState
              title="We couldn't find a plant"
              body={visibleResult.message}
              onRetry={resetScan}
              onScanAgain={resetScan}
            />
          ) : visibleResult?.isPlant ? (
            <PlantResult
              isPremium={isPremium}
              sourcePhotoUri={photo.uri}
              result={visibleResult}
              selectedAlternateIndex={selectedAlternateIndex}
              onSelectAlternate={setSelectedAlternateIndex}
              onScanAgain={resetScan}
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.cameraShell}>
      {cameraPermission?.granted ? (
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      ) : (
        <SafeAreaView style={styles.permissionShell}>
          <View style={styles.permissionPanel}>
            <IconChip icon="camera-outline" size={72} />
            <Text style={styles.permissionTitle}>Ready when your plant is</Text>
            <Text style={styles.permissionText}>
              We only ask for camera access when you choose to scan a plant.
            </Text>
            <Button
              accessibilityLabel={cameraPermissionPrompt.accessibilityLabel}
              gradient
              icon="camera"
              label={cameraPermissionPrompt.buttonLabel}
              onPress={requestCameraPermission}
            />
          </View>
        </SafeAreaView>
      )}

      {cameraPermission?.granted ? (
        <View
          style={[
            styles.cameraOverlay,
            {
              paddingBottom: insets.bottom + theme.spacing.lg,
              paddingTop: insets.top + theme.spacing.md
            }
          ]}
        >
          <View style={styles.modeSwitch}>
            <ModeButton
              active={mode === "identify"}
              label="Identify"
              onPress={() => changeMode("identify")}
            />
            <ModeButton
              active={mode === "diagnose"}
              label="Diagnose"
              onPress={() => changeMode("diagnose")}
            />
          </View>

          <View style={styles.overlayCenter}>
            <ScanFrame size={266} />
            <Text style={styles.hint}>{copy.hint}</Text>
          </View>

          <View style={styles.overlayBottom}>
            {sourcePlantId && mode === "diagnose" ? (
              <Text style={styles.contextHint}>
                Diagnosis will attach to this plant after review.
              </Text>
            ) : null}
            {mode === "diagnose" ? (
              <View style={styles.tipPanel}>
                <Text style={styles.tipText}>📸 Get a close-up of the damage</Text>
                <Text style={styles.tipText}>
                  🌿 Include healthy and affected leaves
                </Text>
              </View>
            ) : null}
            {errorMessage ? (
              <Text style={styles.overlayError}>{errorMessage}</Text>
            ) : null}
            <Text style={styles.privacyHint}>Clear, well-lit photos work best.</Text>
            <View style={styles.captureRow}>
              <PressableScale
                accessibilityLabel="Choose plant photo from gallery"
                accessibilityRole="button"
                onPress={pickPhoto}
                style={styles.galleryButton}
              >
                <MaterialCommunityIcons
                  color={theme.colors.forest}
                  name="image-multiple-outline"
                  size={24}
                />
              </PressableScale>
              <PressableScale
                accessibilityLabel="Take plant photo"
                accessibilityRole="button"
                hapticStyle={undefined}
                onPress={capturePhoto}
                scaleTo={0.92}
                style={styles.shutterButton}
              >
                <View style={styles.shutterInner} />
              </PressableScale>
              <View style={styles.captureSpacer} />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

async function compressPhoto(photo: CapturedPhoto) {
  const longestEdge = Math.max(photo.width ?? 0, photo.height ?? 0);
  const shouldResize = longestEdge > MAX_IMAGE_EDGE;
  const actions =
    shouldResize && photo.width && photo.height
      ? [
          photo.width >= photo.height
            ? { resize: { width: MAX_IMAGE_EDGE } }
            : { resize: { height: MAX_IMAGE_EDGE } }
        ]
      : [];

  const manipulated = await ImageManipulator.manipulateAsync(photo.uri, actions, {
    base64: true,
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG
  });

  if (!manipulated.base64) {
    throw new Error("The photo could not be prepared for scanning.");
  }

  return {
    base64: manipulated.base64,
    uri: manipulated.uri
  };
}

function ModeButton({
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
      accessibilityLabel={`Switch scan mode to ${label}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      containerStyle={styles.modeButtonWrap}
      onPress={onPress}
      style={[styles.modeButton, active ? styles.modeButtonActive : null]}
    >
      <Text
        style={[styles.modeButtonText, active ? styles.modeButtonTextActive : null]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

function PlantResult({
  isPremium,
  result,
  selectedAlternateIndex,
  onSelectAlternate,
  onScanAgain,
  sourcePhotoUri
}: {
  isPremium: boolean;
  result: PlantIdentificationResult;
  selectedAlternateIndex: number | null;
  onSelectAlternate: (index: number | null) => void;
  onScanAgain: () => void;
  sourcePhotoUri: string;
}) {
  const confidence = getConfidenceLabel(result.primary.confidence);
  const hasSpeciesProfile = Boolean(result.speciesId);

  function openPremium(reason: "care_info" | "save_plant") {
    void trackAction(ANALYTICS_EVENTS.PREMIUM_CTA, {
      reason,
      source: "scan_result"
    });

    router.push("/(auth)/premium" as never);
  }

  return (
    <View style={styles.resultPanel}>
      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text style={styles.resultTitle}>{result.primary.commonName}</Text>
          <Text style={styles.scientificName}>{result.primary.scientificName}</Text>
        </View>
        <Badge
          icon="check-decagram"
          label={confidence.label}
          tone={confidence.tone}
        />
      </View>
      <Text style={styles.description}>{result.primary.description}</Text>
      {result.primary.confidence < 0.5 ? (
        <View style={styles.lowConfidenceCard}>
          <MaterialCommunityIcons
            color={theme.colors.terra}
            name="information-outline"
            size={18}
          />
          <Text style={styles.lowConfidenceText}>
            Confidence is low. Try another angle with more leaves in frame before
            saving.
          </Text>
        </View>
      ) : null}
      {result.alternates.length > 0 ? (
        <View style={styles.alternatesSection}>
          <Text style={styles.sectionTitle}>Could it be...</Text>
          {result.alternates.map((alternate, index) => (
            <AlternateCard
              key={`${alternate.scientificName}-${index}`}
              alternate={alternate}
              selected={selectedAlternateIndex === index}
              onPress={() => {
                const isSelecting = selectedAlternateIndex !== index;

                void trackAction(ANALYTICS_EVENTS.ALTERNATE_SELECTED, {
                  alternate_rank: index + 1,
                  selected: isSelecting
                });
                onSelectAlternate(isSelecting ? index : null);
              }}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.resultActions}>
        <Button
          accessibilityLabel="Add identified plant to my plants"
          disabled={!hasSpeciesProfile}
          gradient
          icon={isPremium ? "plus" : "lock-outline"}
          label={isPremium ? "Add to my plants" : "Save with Premium"}
          onPress={() =>
            !isPremium
              ? openPremium("save_plant")
              : result.speciesId
                ? router.push({
                    pathname: "/(auth)/plants/save" as never,
                    params: {
                      speciesId: result.speciesId,
                      photoUri: sourcePhotoUri
                    }
                  })
                : undefined
          }
        />
        <Button
          accessibilityLabel="View care information for identified plant"
          disabled={!hasSpeciesProfile}
          icon={isPremium ? "book-open-variant" : "lock-outline"}
          label={
            hasSpeciesProfile
              ? isPremium
                ? "View care info"
                : "Care info with Premium"
              : "Care info unavailable"
          }
          onPress={() =>
            !isPremium
              ? openPremium("care_info")
              : result.speciesId
                ? router.push({
                    pathname: "/(auth)/species/[speciesId]" as never,
                    params: { speciesId: result.speciesId }
                  })
                : undefined
          }
          variant="secondary"
        />
        <Button
          accessibilityLabel="Scan another plant"
          icon="camera"
          label="Scan again"
          onPress={onScanAgain}
          variant="ghost"
        />
      </View>
    </View>
  );
}

function AlternateCard({
  alternate,
  selected,
  onPress
}: {
  alternate: PlantIdentificationCandidate;
  selected: boolean;
  onPress: () => void;
}) {
  const confidence = getConfidenceLabel(alternate.confidence);

  return (
    <PressableScale
      accessibilityLabel={`${alternate.commonName}, ${confidence.label} confidence`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.alternateCard, selected ? styles.alternateCardSelected : null]}
      onPress={onPress}
    >
      <View style={styles.alternateText}>
        <Text style={styles.alternateName}>{alternate.commonName}</Text>
        <Text style={styles.alternateScientific}>{alternate.scientificName}</Text>
      </View>
      <Badge label={confidence.label} tone={confidence.tone} />
    </PressableScale>
  );
}

function MessageState({
  title,
  body,
  onRetry,
  onScanAgain
}: {
  title: string;
  body: string;
  onRetry: () => void;
  onScanAgain: () => void;
}) {
  return (
    <View style={styles.resultPanel}>
      <Text style={styles.resultTitle}>{title}</Text>
      <Text style={styles.description}>{body}</Text>
      <View style={styles.resultActions}>
        <Button
          accessibilityLabel="Try processing this photo again"
          gradient
          icon="refresh"
          label="Try again"
          onPress={onRetry}
        />
        <Button
          accessibilityLabel="Scan again with a different photo"
          icon="camera"
          label="Scan again"
          onPress={onScanAgain}
          variant="secondary"
        />
      </View>
    </View>
  );
}

function getInitialMode(value: string | string[] | undefined): ScanMode {
  const mode = Array.isArray(value) ? value[0] : value;

  return mode === "diagnose" ? "diagnose" : "identify";
}

function getStringParam(value: string | string[] | undefined) {
  const param = Array.isArray(value) ? value[0] : value;

  return param?.trim() ? param : null;
}

function getModeCopy(mode: ScanMode, hasPlantContext: boolean) {
  if (mode === "diagnose") {
    return {
      hint:
        "Photograph the affected area — yellowing leaves, spots, pests, or unusual damage.",
      loadingTitle: "Checking plant health...",
      loadingText: hasPlantContext
        ? "Reviewing this photo with the saved plant profile."
        : "Reviewing the photo for disease, pests, nutrients, or stress.",
      submitLabel: "Diagnose plant",
      errorFallback: "Please try again with a clearer close-up of the affected area."
    };
  }

  return {
    hint: "Center the plant and get a clear shot of the leaves.",
    loadingTitle: "Identifying your plant...",
    loadingText: "Reviewing leaf shape, color, and growth pattern.",
    submitLabel: "Use this photo",
    errorFallback: "Please try again with a clearer plant photo."
  };
}

function LeafProcessingMark() {
  const pulse = useRef(new Animated.Value(0.72)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 720,
          easing: Easing.inOut(Easing.ease),
          toValue: 1,
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          duration: 720,
          easing: Easing.inOut(Easing.ease),
          toValue: 0.72,
          useNativeDriver: true
        })
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [pulse]);

  return (
    <Animated.View
      accessibilityLabel="Processing scan"
      style={[
        styles.processingMark,
        {
          opacity: pulse,
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0.72, 1],
                outputRange: [0.92, 1.08]
              })
            }
          ]
        }
      ]}
    >
      <MaterialCommunityIcons color={theme.colors.white} name="leaf" size={40} />
    </Animated.View>
  );
}

function getScanErrorMessage(error: unknown, mode: ScanMode) {
  const fallback =
    mode === "identify"
      ? "We couldn't process your photo. Please try again with a clearer plant photo."
      : "We couldn't process your photo. Please try again with a clearer close-up of the affected area.";
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "";
  const normalized = message.toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (
    normalized.includes("network") ||
    normalized.includes("fetch") ||
    normalized.includes("offline")
  ) {
    return "Fernly needs a connection to process scans. Reconnect and try again.";
  }

  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return "We couldn't process your photo in time. Please try again.";
  }

  if (
    normalized.includes("dark") ||
    normalized.includes("blur") ||
    normalized.includes("blurry")
  ) {
    return "The photo may be too dark or blurry. Try a brighter, sharper angle.";
  }

  if (
    normalized.includes("too large") ||
    normalized.includes("invalid") ||
    normalized.includes("validation")
  ) {
    return "That photo could not be processed. Please try another plant photo.";
  }

  return fallback;
}

function getScanFailureReason(error: unknown) {
  const message =
    typeof error === "string"
      ? error.toLowerCase()
      : error instanceof Error
        ? error.message.toLowerCase()
        : "";

  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("offline")
  ) {
    return "network";
  }

  if (message.includes("timeout") || message.includes("timed out")) {
    return "timeout";
  }

  if (
    message.includes("too large") ||
    message.includes("invalid") ||
    message.includes("validation")
  ) {
    return "validation";
  }

  return "unknown";
}

function getConfidenceLabel(confidence: number): { label: string; tone: BadgeTone } {
  if (confidence > 0.8) {
    return { label: "High", tone: "healthy" };
  }

  if (confidence >= 0.5) {
    return { label: "Medium", tone: "attention" };
  }

  return { label: "Low", tone: "sick" };
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.colors.paper,
    flex: 1
  },
  cameraShell: {
    backgroundColor: theme.colors.ink,
    flex: 1
  },
  camera: {
    ...StyleSheet.absoluteFillObject
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.xl
  },
  overlayCenter: {
    alignItems: "center",
    gap: theme.spacing.lg
  },
  overlayBottom: {
    gap: theme.spacing.md
  },
  permissionShell: {
    backgroundColor: theme.colors.paper,
    flex: 1
  },
  permissionPanel: {
    alignItems: "center",
    flex: 1,
    gap: theme.spacing.md,
    justifyContent: "center",
    padding: theme.spacing.xl
  },
  permissionTitle: {
    ...theme.text.title,
    marginTop: theme.spacing.sm,
    textAlign: "center"
  },
  permissionText: {
    ...theme.text.body,
    color: theme.colors.moss,
    marginBottom: theme.spacing.sm,
    textAlign: "center"
  },
  modeSwitch: {
    alignSelf: "center",
    backgroundColor: "rgba(250,246,234,0.94)",
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    padding: 5,
    width: "100%"
  },
  modeButtonWrap: {
    flex: 1
  },
  modeButton: {
    alignItems: "center",
    borderRadius: theme.radius.pill,
    justifyContent: "center",
    minHeight: 44
  },
  modeButtonActive: {
    backgroundColor: theme.colors.forest
  },
  modeButtonText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBlack,
    fontSize: theme.typography.body
  },
  modeButtonTextActive: {
    color: theme.colors.white
  },
  hint: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.body,
    lineHeight: 22,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowRadius: 6
  },
  contextHint: {
    backgroundColor: "rgba(28,63,49,0.82)",
    borderRadius: theme.radius.md,
    color: theme.colors.white,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.caption,
    overflow: "hidden",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    textAlign: "center"
  },
  privacyHint: {
    backgroundColor: "rgba(31,36,31,0.62)",
    borderRadius: theme.radius.md,
    color: theme.colors.white,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.caption,
    lineHeight: 18,
    overflow: "hidden",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    textAlign: "center"
  },
  tipPanel: {
    backgroundColor: "rgba(250,246,234,0.94)",
    borderRadius: theme.radius.md,
    gap: theme.spacing.xs,
    padding: theme.spacing.md
  },
  tipText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.caption
  },
  overlayError: {
    backgroundColor: "rgba(138,67,46,0.92)",
    borderRadius: theme.radius.md,
    color: theme.colors.white,
    fontFamily: theme.typography.fontFamily.bodyBold,
    overflow: "hidden",
    padding: theme.spacing.md,
    textAlign: "center"
  },
  captureRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: theme.spacing.xs,
    width: "100%"
  },
  galleryButton: {
    alignItems: "center",
    backgroundColor: "rgba(250,246,234,0.94)",
    borderRadius: theme.radius.pill,
    height: 56,
    justifyContent: "center",
    width: 56
  },
  shutterButton: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderRadius: 42,
    height: 84,
    justifyContent: "center",
    width: 84
  },
  shutterInner: {
    backgroundColor: theme.colors.canopy,
    borderRadius: 33,
    height: 66,
    width: 66
  },
  captureSpacer: {
    height: 56,
    width: 56
  },
  previewShell: {
    flex: 1
  },
  previewImage: {
    flex: 1,
    resizeMode: "cover"
  },
  previewPanel: {
    backgroundColor: theme.colors.paper,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    gap: theme.spacing.md,
    marginTop: -theme.spacing.xl,
    padding: theme.spacing.lg,
    ...theme.shadow.lifted
  },
  previewActions: {
    flexDirection: "row",
    gap: theme.spacing.md
  },
  previewButton: {
    flex: 1
  },
  loadingShell: {
    backgroundColor: theme.colors.ink,
    flex: 1
  },
  loadingImage: {
    ...StyleSheet.absoluteFillObject
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(25,58,46,0.48)",
    justifyContent: "center",
    padding: theme.spacing.xl
  },
  loadingBadge: {
    alignItems: "center",
    backgroundColor: "rgba(25,58,46,0.9)",
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    width: "100%"
  },
  processingMark: {
    alignItems: "center",
    backgroundColor: theme.colors.leaf,
    borderRadius: theme.radius.pill,
    height: 74,
    justifyContent: "center",
    width: 74
  },
  loadingTitle: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontFamily.displayBold,
    fontSize: theme.typography.title,
    marginTop: theme.spacing.lg,
    textAlign: "center"
  },
  loadingText: {
    color: theme.colors.leafMuted,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.body,
    lineHeight: 23,
    marginTop: theme.spacing.sm,
    textAlign: "center"
  },
  resultContent: {
    paddingBottom: theme.spacing.xxl
  },
  resultPhoto: {
    height: 300,
    resizeMode: "cover",
    width: "100%"
  },
  resultPanel: {
    backgroundColor: theme.colors.paper,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    marginTop: -theme.spacing.xl,
    padding: theme.spacing.xl
  },
  titleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between"
  },
  titleText: {
    flex: 1
  },
  resultTitle: {
    ...theme.text.title
  },
  scientificName: {
    color: theme.colors.moss,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.body,
    fontStyle: "italic",
    marginTop: theme.spacing.xs
  },
  description: {
    ...theme.text.body,
    marginTop: theme.spacing.lg
  },
  lowConfidenceCard: {
    alignItems: "center",
    backgroundColor: theme.colors.blush,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md
  },
  lowConfidenceText: {
    color: theme.colors.ink,
    flex: 1,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.caption,
    lineHeight: 19
  },
  alternatesSection: {
    marginTop: theme.spacing.xl
  },
  sectionTitle: {
    ...theme.text.heading,
    marginBottom: theme.spacing.md
  },
  alternateCard: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    ...theme.shadow.soft
  },
  alternateCardSelected: {
    borderColor: theme.colors.leaf,
    borderWidth: 2
  },
  alternateText: {
    flex: 1
  },
  alternateName: {
    ...theme.text.bodyStrong,
    fontSize: 15
  },
  alternateScientific: {
    color: theme.colors.moss,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.caption,
    fontStyle: "italic",
    marginTop: theme.spacing.xs
  },
  resultActions: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl
  }
});
