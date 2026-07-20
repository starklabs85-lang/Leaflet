import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { CARE_REMINDER_CHANNEL_ID } from "@/lib/notifications/careReminders";
import type { WeatherTip } from "@/types/weather";

// Opt-in severe-weather (frost) alerts. Reuses the care-reminder notification
// channel and permission flow — deliberately not a parallel system. Alerts are
// rare and high-severity only, to protect the notification opt-out guardrail.

// SecureStore rejects ":" in keys; namespaces use "." (alphanumeric, ".", "-", "_" only).
const ENABLED_KEY = "leaflet.weather-alerts-enabled";
const LAST_ALERT_DATE_KEY = "leaflet.weather-alert-last-date";

const EVENING_ALERT_HOUR = 17;

export async function resetWeatherAlertState() {
  await Promise.all([
    SecureStore.deleteItemAsync(ENABLED_KEY),
    SecureStore.deleteItemAsync(LAST_ALERT_DATE_KEY)
  ]);
}

export type WeatherAlertResult =
  | { ok: true; enabled: boolean }
  | { ok: false; message: string };

export async function isWeatherAlertsEnabled() {
  return (await SecureStore.getItemAsync(ENABLED_KEY)) === "true";
}

export async function setWeatherAlertsEnabled(
  enabled: boolean
): Promise<WeatherAlertResult> {
  if (!enabled) {
    await SecureStore.setItemAsync(ENABLED_KEY, "false");

    return { ok: true, enabled: false };
  }

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CARE_REMINDER_CHANNEL_ID, {
        name: "Care reminders",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250]
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    const permission =
      existing.status === "granted"
        ? existing
        : await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowBadge: true, allowSound: true }
          });

    if (permission.status !== "granted") {
      await SecureStore.setItemAsync(ENABLED_KEY, "false");

      return {
        ok: false,
        message:
          "Notification permission was not granted. You can enable weather alerts later in Settings."
      };
    }
  } catch {
    await SecureStore.setItemAsync(ENABLED_KEY, "false");

    return { ok: false, message: "Weather alerts are unavailable on this device." };
  }

  await SecureStore.setItemAsync(ENABLED_KEY, "true");

  return { ok: true, enabled: true };
}

function eveningAlertDate() {
  const date = new Date();

  date.setHours(EVENING_ALERT_HOUR, 0, 0, 0);

  if (date.getTime() - Date.now() < 60_000) {
    // Past (or within a minute of) the evening slot: deliver shortly after the
    // user leaves the app instead of dropping the warning entirely.
    return new Date(Date.now() + 2 * 60_000);
  }

  return date;
}

export async function maybeNotifySevereWeather({
  tips,
  localDate
}: {
  tips: WeatherTip[];
  localDate: string;
}) {
  try {
    const severeTip = tips.find((tip) => tip.notify);

    if (!severeTip) {
      return;
    }

    const [enabled, lastAlertDate, permission] = await Promise.all([
      isWeatherAlertsEnabled(),
      SecureStore.getItemAsync(LAST_ALERT_DATE_KEY),
      Notifications.getPermissionsAsync()
    ]);

    // At most one severe-weather alert per day.
    if (!enabled || permission.status !== "granted" || lastAlertDate === localDate) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Frost warning for your plants",
        body: severeTip.message,
        data: {
          kind: "weather_alert",
          userPlantId: severeTip.plantId
        }
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        channelId: CARE_REMINDER_CHANNEL_ID,
        date: eveningAlertDate()
      }
    });

    await SecureStore.setItemAsync(LAST_ALERT_DATE_KEY, localDate);
  } catch {
    // Alert scheduling must never break the surface that triggered it.
  }
}
