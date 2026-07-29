import type { ExpoConfig } from "expo/config";

const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
const cameraPermission =
  "Fernly uses your camera to take plant photos for identification, health diagnosis, and growth tracking—for example, photographing a leaf to identify the plant or check for disease.";
const photoLibraryPermission =
  "Fernly uses your photo library to choose plant photos for identification, health diagnosis, and growth tracking—for example, selecting a leaf photo to identify the plant or add it to a growth timeline.";

const config: ExpoConfig = {
  name: "Fernly",
  slug: "leaflet",
  scheme: "leaflet",
  version: "1.0.2",
  orientation: "portrait",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  icon: "./FlexLeaf Plant Analyzer Creatives.png",
  ios: {
    supportsTablet: true,
    icon: "./FlexLeaf Plant Analyzer Creatives.png",
    bundleIdentifier: "com.countrybean.leaflet",
    usesAppleSignIn: true,
    googleServicesFile: "./GoogleService-Info.plist",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false
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
    eas: {
      projectId: "63ea258d-3a71-4b3e-b43b-0d1d94baa969"
    }
  }
};

export default config;
