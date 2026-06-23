import { Platform } from "react-native";
import { getAnalytics, logScreenView } from "@react-native-firebase/analytics";

function getFirebaseAnalytics() {
  if (Platform.OS !== "android" && Platform.OS !== "ios") {
    return null;
  }

  try {
    return getAnalytics();
  } catch (error) {
    if (__DEV__) {
      console.warn("Firebase Analytics is not ready.", error);
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
    if (__DEV__) {
      console.warn("Firebase screen_view was not logged.", error);
    }
  }
}
