import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { PressableScale } from "@/components/ui/PressableScale";
import { theme } from "@/constants/theme";
import { applyWeatherCareAdjustment } from "@/lib/api/careSchedule";
import { fetchWeatherTips } from "@/lib/api/weatherTips";
import { getStoredUserLocation } from "@/lib/location/userLocation";
import { describeWeatherCode } from "@/lib/weather/weatherCodes";
import type { WeatherTip, WeatherTipsResponse } from "@/types/weather";

type NoteState =
  | { status: "hidden" }
  | { status: "loading" }
  | { status: "ready"; data: WeatherTipsResponse };

export function PlantWeatherNote({
  plantId,
  onTaskAdjusted
}: {
  plantId: string;
  onTaskAdjusted?: () => void;
}) {
  const [state, setState] = useState<NoteState>({ status: "loading" });
  const [pendingTipId, setPendingTipId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const location = await getStoredUserLocation();

      if (!location) {
        if (isMounted) {
          setState({ status: "hidden" });
        }
        return;
      }

      // Server caches by coords + date and user + day, so this reuses the
      // dashboard's fetch instead of paying for a second forecast.
      const result = await fetchWeatherTips(location);

      if (!isMounted) {
        return;
      }

      setState(result.ok ? { status: "ready", data: result.data } : { status: "hidden" });
    })();

    return () => {
      isMounted = false;
    };
  }, [plantId]);

  async function runAction(tip: WeatherTip) {
    if (!tip.action || pendingTipId) {
      return;
    }

    setPendingTipId(tip.id);
    setMessage(null);

    const result = await applyWeatherCareAdjustment({
      taskId: tip.action.taskId,
      kind: tip.action.kind,
      days: tip.action.days
    });

    setPendingTipId(null);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setMessage(
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
    onTaskAdjusted?.();
  }

  if (state.status === "hidden") {
    return null;
  }

  if (state.status === "loading") {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={theme.colors.forest} size="small" />
      </View>
    );
  }

  const condition = describeWeatherCode(state.data.weather.today.weatherCode);
  const plantTips = state.data.tips.filter((tip) => tip.plantId === plantId);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons
          color={theme.colors.forest}
          name={condition.icon}
          size={18}
        />
        <Text style={styles.headerText}>
          {condition.label} · {Math.round(state.data.weather.today.minTemp)}° to{" "}
          {Math.round(state.data.weather.today.maxTemp)}°
        </Text>
      </View>
      {plantTips.length > 0 ? (
        plantTips.map((tip) => (
          <View key={tip.id} style={styles.tipBlock}>
            <Text style={styles.tipText}>{tip.message}</Text>
            {tip.action ? (
              <PressableScale
                accessibilityLabel={tip.action.label}
                accessibilityRole="button"
                disabled={pendingTipId === tip.id}
                onPress={() => runAction(tip)}
                style={styles.actionButton}
              >
                {pendingTipId === tip.id ? (
                  <ActivityIndicator color={theme.colors.forest} size="small" />
                ) : (
                  <Text style={styles.actionText}>{tip.action.label}</Text>
                )}
              </PressableScale>
            ) : null}
          </View>
        ))
      ) : (
        <Text style={styles.calmText}>
          No weather concerns for this plant today.
        </Text>
      )}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.leafMuted,
    borderRadius: theme.radius.md,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs
  },
  headerText: {
    ...theme.text.caption,
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold
  },
  tipBlock: {
    gap: theme.spacing.sm
  },
  tipText: {
    ...theme.text.body,
    color: theme.colors.ink
  },
  actionButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md
  },
  actionText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.caption
  },
  calmText: {
    ...theme.text.caption,
    color: theme.colors.moss
  },
  message: {
    ...theme.text.caption,
    color: theme.colors.forest
  }
});
