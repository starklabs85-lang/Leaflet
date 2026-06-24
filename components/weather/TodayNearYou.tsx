import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";

import { Card } from "@/components/ui/Card";
import { PressableScale } from "@/components/ui/PressableScale";
import { theme } from "@/constants/theme";
import {
  applyWeatherCareAdjustment,
  getLocalDateString
} from "@/lib/api/careSchedule";
import { fetchWeatherTips } from "@/lib/api/weatherTips";
import {
  captureDeviceLocation,
  getStoredUserLocation,
  markWeatherLocationPromptSeen,
  setManualCityLocation,
  type StoredUserLocation
} from "@/lib/location/userLocation";
import { maybeNotifySevereWeather } from "@/lib/notifications/weatherAlerts";
import { describeWeatherCode } from "@/lib/weather/weatherCodes";
import type {
  WeatherTip,
  WeatherTipSeverity,
  WeatherTipsResponse
} from "@/types/weather";

type WeatherState =
  | { status: "checking" }
  | { status: "needs_location" }
  | { status: "loading"; location: StoredUserLocation }
  | { status: "ready"; location: StoredUserLocation; data: WeatherTipsResponse }
  | { status: "unavailable" };

const SEVERITY_COLORS: Record<WeatherTipSeverity, string> = {
  high: theme.colors.terra,
  medium: theme.colors.ochre,
  low: theme.colors.forest
};

export function TodayNearYou({
  hasPlants,
  onCareTaskAdjusted
}: {
  hasPlants: boolean;
  onCareTaskAdjusted?: () => void;
}) {
  const [state, setState] = useState<WeatherState>({ status: "checking" });
  const [showCityInput, setShowCityInput] = useState(false);
  const [cityDraft, setCityDraft] = useState("");
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [pendingTipId, setPendingTipId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadWeather = useCallback(async (location: StoredUserLocation) => {
    setState({ status: "loading", location });

    const result = await fetchWeatherTips(location);

    if (!result.ok) {
      // No weather, no error wall: fall back to species-only guidance.
      setState({ status: "unavailable" });
      return;
    }

    setState({ status: "ready", location, data: result.data });
    maybeNotifySevereWeather({
      tips: result.data.tips,
      localDate: getLocalDateString()
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    getStoredUserLocation().then((location) => {
      if (!isMounted) {
        return;
      }

      if (!location) {
        setState({ status: "needs_location" });
        return;
      }

      loadWeather(location);
    });

    return () => {
      isMounted = false;
    };
  }, [loadWeather]);

  async function useDeviceLocation() {
    setSetupBusy(true);
    setSetupMessage(null);
    await markWeatherLocationPromptSeen();

    const result = await captureDeviceLocation();

    setSetupBusy(false);

    if (!result.ok) {
      setSetupMessage(result.message);
      setShowCityInput(true);
      return;
    }

    loadWeather(result.location);
  }

  async function saveCity() {
    setSetupBusy(true);
    setSetupMessage(null);
    await markWeatherLocationPromptSeen();

    const result = await setManualCityLocation(cityDraft);

    setSetupBusy(false);

    if (!result.ok) {
      setSetupMessage(result.message);
      return;
    }

    setShowCityInput(false);
    loadWeather(result.location);
  }

  async function runTipAction(tip: WeatherTip) {
    if (!tip.action || pendingTipId) {
      return;
    }

    setPendingTipId(tip.id);
    setActionMessage(null);

    const result = await applyWeatherCareAdjustment({
      taskId: tip.action.taskId,
      kind: tip.action.kind,
      days: tip.action.days
    });

    setPendingTipId(null);

    if (!result.ok) {
      setActionMessage(result.message);
      return;
    }

    setActionMessage(
      tip.action.kind === "snooze_watering"
        ? `Watering snoozed until ${result.data.nextDueDate}.`
        : `Watering moved up to ${result.data.nextDueDate}.`
    );
    setState((current) => {
      if (current.status !== "ready") {
        return current;
      }

      return {
        ...current,
        data: {
          ...current.data,
          tips: current.data.tips.map((existing) =>
            existing.id === tip.id ? { ...existing, action: null } : existing
          )
        }
      };
    });
    onCareTaskAdjusted?.();
  }

  if (!hasPlants || state.status === "unavailable" || state.status === "checking") {
    return null;
  }

  if (state.status === "needs_location") {
    return (
      <Card elevated={false} style={styles.card}>
        <View style={styles.setupHeader}>
          <MaterialCommunityIcons
            color={theme.colors.forest}
            name="weather-partly-cloudy"
            size={22}
          />
          <Text style={styles.setupTitle}>Care tips for your weather</Text>
        </View>
        <Text style={styles.setupBody}>
          Allow location so Fernly can tailor care to your local weather - frost
          warnings, rainy-day watering skips, and heat-wave checks. Your location
          stays coarse and is used only for weather.
        </Text>
        {showCityInput ? (
          <View style={styles.cityRow}>
            <TextInput
              maxLength={60}
              onChangeText={setCityDraft}
              placeholder="Your city"
              placeholderTextColor={theme.colors.moss}
              style={styles.cityInput}
              value={cityDraft}
            />
            <PressableScale
              accessibilityLabel="Save city for weather tips"
              accessibilityRole="button"
              onPress={saveCity}
              style={styles.cityButton}
            >
              {setupBusy ? (
                <ActivityIndicator color={theme.colors.white} size="small" />
              ) : (
                <Text style={styles.cityButtonText}>Save</Text>
              )}
            </PressableScale>
          </View>
        ) : (
          <View style={styles.setupActions}>
            <PressableScale
              accessibilityLabel="Use my location for weather tips"
              accessibilityRole="button"
              onPress={useDeviceLocation}
              style={styles.primaryAction}
            >
              {setupBusy ? (
                <ActivityIndicator color={theme.colors.white} size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    color={theme.colors.white}
                    name="crosshairs-gps"
                    size={16}
                  />
                  <Text style={styles.primaryActionText}>Use my location</Text>
                </>
              )}
            </PressableScale>
            <PressableScale
              accessibilityLabel="Enter a city manually instead"
              accessibilityRole="button"
              onPress={() => setShowCityInput(true)}
              style={styles.secondaryAction}
            >
              <Text style={styles.secondaryActionText}>Enter city</Text>
            </PressableScale>
          </View>
        )}
        {setupMessage ? <Text style={styles.setupMessage}>{setupMessage}</Text> : null}
      </Card>
    );
  }

  if (state.status === "loading") {
    return (
      <Card elevated={false} style={styles.card}>
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.forest} size="small" />
          <Text style={styles.loadingText}>Checking your local weather…</Text>
        </View>
      </Card>
    );
  }

  const { weather, tips } = state.data;
  const condition = describeWeatherCode(weather.today.weatherCode);
  const locationLabel = state.location.label ?? "near you";

  return (
    <Card elevated={false} style={styles.card}>
      <View style={styles.strip}>
        <MaterialCommunityIcons
          color={theme.colors.forest}
          name={condition.icon}
          size={28}
        />
        <View style={styles.stripCopy}>
          <Text style={styles.stripTitle}>Today in {locationLabel}</Text>
          <Text style={styles.stripSubtitle}>
            {condition.label} · {Math.round(weather.current.temperature)}°C now ·{" "}
            {Math.round(weather.today.minTemp)}° to {Math.round(weather.today.maxTemp)}°
          </Text>
        </View>
      </View>

      {tips.length > 0 ? (
        <View style={styles.tipsList}>
          {tips.map((tip) => (
            <View key={tip.id} style={styles.tipRow}>
              <View
                style={[
                  styles.tipDot,
                  { backgroundColor: SEVERITY_COLORS[tip.severity] }
                ]}
              />
              <View style={styles.tipBody}>
                <PressableScale
                  accessibilityLabel={
                    tip.plantId ? `Open ${tip.plantName}` : "Weather tip"
                  }
                  accessibilityRole={tip.plantId ? "button" : "text"}
                  disabled={!tip.plantId}
                  haptic={false}
                  onPress={() =>
                    tip.plantId
                      ? router.push({
                          pathname: "/(auth)/plants/[plantId]" as never,
                          params: { plantId: tip.plantId }
                        })
                      : undefined
                  }
                >
                  <Text style={styles.tipText}>{tip.message}</Text>
                </PressableScale>
                {tip.action ? (
                  <PressableScale
                    accessibilityLabel={tip.action.label}
                    accessibilityRole="button"
                    disabled={pendingTipId === tip.id}
                    onPress={() => runTipAction(tip)}
                    style={styles.tipActionButton}
                  >
                    {pendingTipId === tip.id ? (
                      <ActivityIndicator color={theme.colors.forest} size="small" />
                    ) : (
                      <>
                        <MaterialCommunityIcons
                          color={theme.colors.forest}
                          name={
                            tip.action.kind === "snooze_watering"
                              ? "sleep"
                              : "watering-can-outline"
                          }
                          size={16}
                        />
                        <Text style={styles.tipActionText}>{tip.action.label}</Text>
                      </>
                    )}
                  </PressableScale>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.noTipsText}>
          No weather worries today — your usual care schedule is spot on.
        </Text>
      )}

      {actionMessage ? <Text style={styles.actionMessage}>{actionMessage}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.md
  },
  setupHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  setupTitle: {
    ...theme.text.title,
    fontSize: theme.typography.body + 2
  },
  setupBody: {
    ...theme.text.body,
    color: theme.colors.moss
  },
  setupActions: {
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: theme.colors.forest,
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    gap: theme.spacing.xs,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: theme.spacing.lg
  },
  primaryActionText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.caption
  },
  secondaryAction: {
    alignItems: "center",
    borderColor: theme.colors.line,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: theme.spacing.lg
  },
  secondaryActionText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.caption
  },
  cityRow: {
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  cityInput: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.colors.ink,
    flex: 1,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.body,
    minHeight: 44,
    paddingHorizontal: theme.spacing.md
  },
  cityButton: {
    alignItems: "center",
    backgroundColor: theme.colors.forest,
    borderRadius: theme.radius.md,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: theme.spacing.lg
  },
  cityButtonText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.caption
  },
  setupMessage: {
    ...theme.text.caption,
    color: theme.colors.terra
  },
  loadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  loadingText: {
    ...theme.text.body,
    color: theme.colors.moss
  },
  strip: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md
  },
  stripCopy: {
    flex: 1
  },
  stripTitle: {
    ...theme.text.title,
    fontSize: theme.typography.body + 2
  },
  stripSubtitle: {
    ...theme.text.caption,
    marginTop: 2
  },
  tipsList: {
    gap: theme.spacing.md
  },
  tipRow: {
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  tipDot: {
    borderRadius: 5,
    height: 10,
    marginTop: 6,
    width: 10
  },
  tipBody: {
    flex: 1,
    gap: theme.spacing.sm
  },
  tipText: {
    ...theme.text.body,
    color: theme.colors.ink
  },
  tipActionButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.colors.leafMuted,
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    gap: theme.spacing.xs,
    minHeight: 36,
    paddingHorizontal: theme.spacing.md
  },
  tipActionText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.caption
  },
  noTipsText: {
    ...theme.text.body,
    color: theme.colors.moss
  },
  actionMessage: {
    ...theme.text.caption,
    color: theme.colors.forest
  }
});
