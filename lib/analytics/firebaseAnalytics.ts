import { Platform } from "react-native";
import { getApps } from "@react-native-firebase/app";
import {
  getAnalytics,
  logEvent,
  logScreenView,
  setUserId,
  setUserProperties
} from "@react-native-firebase/analytics";

import {
  ANALYTICS_EVENTS,
  ANALYTICS_USER_PROPERTY_KEYS,
  sanitizeAnalyticsEventName,
  sanitizeAnalyticsParams,
  sanitizeAnalyticsUserProperties,
  type AnalyticsEventName,
  type AnalyticsParams,
  type AnalyticsTapName,
  type AnalyticsUserProperties
} from "@/lib/analytics/events";

export {
  ANALYTICS_EVENTS,
  ANALYTICS_TAPS,
  toCountBucket
} from "@/lib/analytics/events";
export type {
  AnalyticsEventName,
  AnalyticsParams,
  AnalyticsTapName,
  AnalyticsUserProperties
} from "@/lib/analytics/events";

let hasWarnedAboutUnexpectedAnalyticsError = false;
let hasWarnedAboutScreenViewError = false;
let hasWarnedAboutActionError = false;
let hasWarnedAboutUserError = false;

function getFirebaseAnalytics() {
  if (Platform.OS !== "ios") {
    return null;
  }

  if (getApps().length === 0) {
    return null;
  }

  try {
    return getAnalytics();
  } catch (error) {
    if (__DEV__ && !hasWarnedAboutUnexpectedAnalyticsError) {
      hasWarnedAboutUnexpectedAnalyticsError = true;
      console.warn("Firebase Analytics failed to initialize.", error);
    }

    return null;
  }
}

export async function trackScreenView(screenName: string) {
  const analytics = getFirebaseAnalytics();

  if (!analytics) {
    return;
  }

  try {
    await logScreenView(analytics, {
      screen_name: screenName,
      screen_class: screenName
    });
  } catch (error) {
    if (__DEV__ && !hasWarnedAboutScreenViewError) {
      hasWarnedAboutScreenViewError = true;
      console.warn("Firebase screen_view was not logged.", error);
    }
  }
}

export const trackFirebaseScreenView = trackScreenView;

export async function trackAction(
  eventName: AnalyticsEventName,
  params?: AnalyticsParams
) {
  const analytics = getFirebaseAnalytics();

  if (!analytics) {
    return;
  }

  const sanitizedEventName = sanitizeAnalyticsEventName(eventName);
  const sanitizedParams = sanitizeAnalyticsParams(params);

  if (!sanitizedEventName) {
    return;
  }

  try {
    await logEvent(analytics, sanitizedEventName, sanitizedParams);
  } catch (error) {
    if (__DEV__ && !hasWarnedAboutActionError) {
      hasWarnedAboutActionError = true;
      console.warn("Firebase analytics event was not logged.", error);
    }
  }
}

export async function trackTap(
  controlName: AnalyticsTapName,
  params?: AnalyticsParams
) {
  await trackAction(ANALYTICS_EVENTS.UI_TAP, {
    control_name: controlName,
    ...params
  });
}

export async function setAnalyticsUser(
  userId: string,
  properties: AnalyticsUserProperties = {}
) {
  const analytics = getFirebaseAnalytics();

  if (!analytics) {
    return;
  }

  try {
    await setUserId(analytics, userId);

    const sanitizedProperties = sanitizeAnalyticsUserProperties({
      platform: Platform.OS,
      ...properties
    });

    if (Object.keys(sanitizedProperties).length > 0) {
      await setUserProperties(analytics, sanitizedProperties);
    }
  } catch (error) {
    if (__DEV__ && !hasWarnedAboutUserError) {
      hasWarnedAboutUserError = true;
      console.warn("Firebase analytics user properties were not set.", error);
    }
  }
}

export async function clearAnalyticsUser() {
  const analytics = getFirebaseAnalytics();

  if (!analytics) {
    return;
  }

  try {
    await setUserId(analytics, null);
    await setUserProperties(
      analytics,
      Object.fromEntries(
        ANALYTICS_USER_PROPERTY_KEYS.map((key) => [key, null])
      )
    );
  } catch (error) {
    if (__DEV__ && !hasWarnedAboutUserError) {
      hasWarnedAboutUserError = true;
      console.warn("Firebase analytics user properties were not cleared.", error);
    }
  }
}
