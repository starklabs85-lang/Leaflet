export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
  googleIosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ?? "",
  revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "",
  revenueCatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "",
  appsFlyerDevKey: process.env.EXPO_PUBLIC_APPSFLYER_DEV_KEY ?? "",
  appsFlyerIosAppId:
    process.env.EXPO_PUBLIC_APPSFLYER_IOS_APP_ID ?? "6775880316",
  appsFlyerOneLinkDomain:
    process.env.EXPO_PUBLIC_APPSFLYER_ONELINK_DOMAIN ?? "",
  appsFlyerOneLinkTemplateId:
    process.env.EXPO_PUBLIC_APPSFLYER_ONELINK_TEMPLATE_ID ?? "",
  devTestEmail: process.env.EXPO_PUBLIC_DEV_TEST_EMAIL ?? "",
  devTestPassword: process.env.EXPO_PUBLIC_DEV_TEST_PASSWORD ?? ""
};

// Dev-only email/password bypass for testing the app while native OAuth is
// unavailable. Never enabled in production builds.
export function hasDevTestLogin() {
  return __DEV__ && Boolean(env.devTestEmail && env.devTestPassword);
}

export function hasSupabaseConfig() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export function getSupabaseConfigIssue() {
  if (hasSupabaseConfig()) {
    return null;
  }

  const missing = [
    env.supabaseUrl ? null : "EXPO_PUBLIC_SUPABASE_URL",
    env.supabaseAnonKey ? null : "EXPO_PUBLIC_SUPABASE_ANON_KEY"
  ].filter(Boolean);

  return `Missing ${missing.join(" and ")}. Copy .env.example to .env and add your Supabase project values.`;
}

export function hasRevenueCatConfig() {
  if (process.env.EXPO_OS === "ios") {
    return Boolean(env.revenueCatIosKey);
  }

  return Boolean(env.revenueCatAndroidKey);
}

export function getRevenueCatConfigIssue() {
  if (hasRevenueCatConfig()) {
    return null;
  }

  const missing =
    process.env.EXPO_OS === "ios"
      ? "EXPO_PUBLIC_REVENUECAT_IOS_KEY"
      : "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY";

  return `Missing ${missing}. Add the public RevenueCat SDK key for this platform.`;
}

export function hasGoogleConfig() {
  if (!env.googleWebClientId) {
    return false;
  }

  if (process.env.EXPO_OS === "ios") {
    return Boolean(env.googleIosClientId && env.googleIosUrlScheme);
  }

  return true;
}

export function getGoogleConfigIssue() {
  if (hasGoogleConfig()) {
    return null;
  }

  const missing = [
    env.googleWebClientId ? null : "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
    process.env.EXPO_OS === "ios" && !env.googleIosClientId
      ? "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID"
      : null,
    process.env.EXPO_OS === "ios" && !env.googleIosUrlScheme
      ? "EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME"
      : null
  ].filter(Boolean);

  return `Missing ${missing.join(", ")}. Add the public Google OAuth client values from Google Cloud.`;
}

export function hasMeasurementConfig() {
  return Boolean(
    env.appsFlyerDevKey &&
      env.appsFlyerIosAppId === "6775880316"
  );
}
