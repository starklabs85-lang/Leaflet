export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
  googleIosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ?? ""
};

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
