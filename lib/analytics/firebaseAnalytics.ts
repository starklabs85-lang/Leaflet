import { Platform } from "react-native";
import { getApps } from "@react-native-firebase/app";
import { getAnalytics, logScreenView } from "@react-native-firebase/analytics";

let hasWarnedAboutUnexpectedAnalyticsError = false;
let hasWarnedAboutScreenViewError = false;

function getFirebaseAnalytics() {
  if (Platform.OS !== "android" && Platform.OS !== "ios") {
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

export async function trackFirebaseScreenView(screenName: string) {
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
