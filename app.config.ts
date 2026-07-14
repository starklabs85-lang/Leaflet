import type { ExpoConfig } from "expo/config";

const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;

const config: ExpoConfig = {
  name: "Fernly",
  slug: "leaflet",
  scheme: "leaflet",
  version: "0.1.0",
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
    "expo-camera",
    "expo-image-picker",
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
