import type { ExpoConfig } from "expo/config";

const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;

const config: ExpoConfig = {
  name: "Leaflet",
  slug: "leaflet",
  scheme: "leaflet",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.countrybean.leaflet",
    usesAppleSignIn: true
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
    ...(googleIosUrlScheme
      ? [
          [
            "@react-native-google-signin/google-signin",
            { iosUrlScheme: googleIosUrlScheme }
          ] as [string, { iosUrlScheme: string }]
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
