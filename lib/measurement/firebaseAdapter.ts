import { Platform } from "react-native";
import { getApps } from "@react-native-firebase/app";
import {
  getAnalytics,
  logEvent,
  logScreenView,
  setAnalyticsCollectionEnabled,
  setUserId,
  setUserProperties
} from "@react-native-firebase/analytics";

import {
  ANALYTICS_USER_PROPERTY_KEYS,
  sanitizeAnalyticsUserProperties
} from "@/lib/analytics/events";
import type { MeasurementAdapter } from "@/lib/analytics/measurementCore";

function getFirebaseAnalytics() {
  if (Platform.OS !== "ios" || getApps().length === 0) {
    return null;
  }

  return getAnalytics();
}

export function createFirebaseMeasurementAdapter(): MeasurementAdapter {
  return {
    async start() {
      const analytics = getFirebaseAnalytics();

      if (analytics) {
        await setAnalyticsCollectionEnabled(analytics, true);
      }
    },

    async disable() {
      const analytics = getFirebaseAnalytics();

      if (analytics) {
        await setAnalyticsCollectionEnabled(analytics, false);
      }
    },

    async trackAction(name, params) {
      const analytics = getFirebaseAnalytics();

      if (analytics) {
        await logEvent(analytics, name, params);
      }
    },

    async trackScreenView(name) {
      const analytics = getFirebaseAnalytics();

      if (analytics) {
        await logScreenView(analytics, {
          screen_class: name,
          screen_name: name
        });
      }
    },

    async setUser(userId, properties) {
      const analytics = getFirebaseAnalytics();

      if (!analytics) {
        return;
      }

      await setUserId(analytics, userId);
      const sanitizedProperties = sanitizeAnalyticsUserProperties({
        platform: Platform.OS,
        ...properties
      });

      if (Object.keys(sanitizedProperties).length > 0) {
        await setUserProperties(analytics, sanitizedProperties);
      }
    },

    async clearUser() {
      const analytics = getFirebaseAnalytics();

      if (!analytics) {
        return;
      }

      await setUserId(analytics, null);
      await setUserProperties(
        analytics,
        Object.fromEntries(
          ANALYTICS_USER_PROPERTY_KEYS.map((key) => [key, null])
        )
      );
    }
  };
}
