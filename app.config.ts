import type { ExpoConfig } from "expo/config";

const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
const googleServicesFile =
  process.env.GOOGLE_SERVICES_INFO_PLIST ?? "./GoogleService-Info.plist";
const appsFlyerOneLinkHost = normalizeHttpsHost(
  process.env.EXPO_PUBLIC_APPSFLYER_ONELINK_DOMAIN
);
const cameraPermission =
  "Fernly uses your camera to take plant photos for identification, health diagnosis, and growth tracking—for example, photographing a leaf to identify the plant or check for disease.";
const photoLibraryPermission =
  "Fernly uses your photo library to choose plant photos for identification, health diagnosis, and growth tracking—for example, selecting a leaf photo to identify the plant or add it to a growth timeline.";
const userTrackingPermission =
  "Fernly uses your device identifier to measure which ads lead to installs and subscriptions. Your choice does not affect app features.";

const config: ExpoConfig = {
  name: "Fernly",
  slug: "leaflet",
  scheme: "leaflet",
  version: "1.0.3",
  orientation: "portrait",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  icon: "./assets/icon.png",
  ios: {
    supportsTablet: true,
    icon: "./assets/icon.png",
    bundleIdentifier: "com.countrybean.leaflet",
    usesAppleSignIn: true,
    googleServicesFile,
    ...(appsFlyerOneLinkHost
      ? { associatedDomains: [`applinks:${appsFlyerOneLinkHost}`] }
      : {}),
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      FirebaseAnalyticsCollectionEnabled: false,
      FirebaseAutomaticScreenReportingEnabled: false,
      NSAdvertisingAttributionReportEndpoint:
        "https://appsflyer-skadnetwork.com/",
      AdAttributionKit: "https://appsflyer-skadnetwork.com/",
      EligibleForAdAttributionKitReengagementPostbackCopies: true
    }
  },
  android: {
    package: "com.countrybean.leaflet"
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-dev-client",
    "expo-secure-store",
    [
      "expo-camera",
      {
        cameraPermission,
        microphonePermission: false,
        recordAudioAndroid: false
      }
    ],
    [
      "expo-image-picker",
      {
        cameraPermission,
        microphonePermission: false,
        photosPermission: photoLibraryPermission
      }
    ],
    "expo-notifications",
    "expo-apple-authentication",
    [
      "expo-tracking-transparency",
      {
        userTrackingPermission
      }
    ],
    [
      "react-native-appsflyer",
      {
        shouldUseStrictMode: false,
        shouldUsePurchaseConnector: false,
        preferAppsFlyerBackupRules: false
      }
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Fernly uses your approximate location only to tailor plant care tips to your local weather.",
        isAndroidBackgroundLocationEnabled: false
      }
    ],
    "./plugins/withIosFirebaseApp",
    [
      "@react-native-firebase/analytics",
      {
        ios: {
          withoutAdIdSupport: true
        }
      }
    ],
    [
      "expo-build-properties",
      {
        ios: {
          useFrameworks: "static",
          forceStaticLinking: ["RNFBAnalytics", "RNFBApp"]
        }
      }
    ],
    ...(googleIosUrlScheme
      ? [
          [
            "@react-native-google-signin/google-signin",
            { iosUrlScheme: googleIosUrlScheme }
          ] as [string, { iosUrlScheme: string }],
          "./plugins/withGoogleSignInModularHeaders"
        ]
      : [])
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
    googleIosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ?? "",
    appsFlyerIosAppId:
      process.env.EXPO_PUBLIC_APPSFLYER_IOS_APP_ID ?? "6775880316",
    appsFlyerOneLinkDomain:
      process.env.EXPO_PUBLIC_APPSFLYER_ONELINK_DOMAIN ?? "",
    appsFlyerOneLinkTemplateId:
      process.env.EXPO_PUBLIC_APPSFLYER_ONELINK_TEMPLATE_ID ?? "",
    eas: {
      projectId: "63ea258d-3a71-4b3e-b43b-0d1d94baa969"
    }
  }
};

function normalizeHttpsHost(value: string | undefined) {
  if (!value) {
    return "";
  }

  const trimmed = value.trim().toLowerCase();
  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);

    return parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".onelink.me") &&
      parsed.pathname === "/" &&
      !parsed.search &&
      !parsed.hash
      ? parsed.hostname
      : "";
  } catch {
    return "";
  }
}

export default config;
