import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

import { env, getGoogleConfigIssue, hasDevTestLogin, hasGoogleConfig } from "@/lib/env";
import { getSupabaseClient } from "@/lib/supabase";

type GoogleSignInModule = typeof import("@react-native-google-signin/google-signin");

let googleSignInModule: GoogleSignInModule | null = null;
let googleConfigured = false;

async function createNoncePair() {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );

  return { rawNonce, hashedNonce };
}

async function getGoogleSignInModule() {
  if (googleSignInModule) {
    return googleSignInModule;
  }

  try {
    googleSignInModule = await import("@react-native-google-signin/google-signin");
    return googleSignInModule;
  } catch {
    throw new Error(
      "Google sign-in requires a Leaflet development build. Open the app with the Leaflet dev client instead of Expo Go."
    );
  }
}

async function configureGoogleSignIn() {
  if (googleConfigured) {
    return (await getGoogleSignInModule()).GoogleSignin;
  }

  if (!hasGoogleConfig()) {
    throw new Error(getGoogleConfigIssue() ?? "Google sign-in is not configured.");
  }

  const { GoogleSignin } = await getGoogleSignInModule();

  GoogleSignin.configure({
    webClientId: env.googleWebClientId,
    iosClientId: env.googleIosClientId || undefined,
    scopes: ["profile", "email"]
  });

  googleConfigured = true;
  return GoogleSignin;
}

export function isUserCancelledAuthError(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code).toLowerCase()
      : "";

  if (
    code === "12501" ||
    code.includes("cancel") ||
    code.includes("sign_in_cancelled")
  ) {
    return true;
  }

  return (
    error instanceof Error &&
    (error.message.includes("ERR_REQUEST_CANCELED") ||
      error.message.includes("cancelled"))
  );
}

export async function signInWithAppleIdToken() {
  if (Platform.OS !== "ios") {
    throw new Error("Sign in with Apple is available on iOS devices only.");
  }

  const isAvailable = await AppleAuthentication.isAvailableAsync();

  if (!isAvailable) {
    throw new Error("Sign in with Apple is not available on this device.");
  }

  const { rawNonce, hashedNonce } = await createNoncePair();

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL
    ],
    nonce: hashedNonce
  });

  if (!credential.identityToken) {
    throw new Error("Apple did not return an identity token. Please try again.");
  }

  const { error } = await getSupabaseClient().auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce: rawNonce
  });

  if (error) {
    throw error;
  }
}

export async function signInWithGoogleIdToken() {
  const GoogleSignin = await configureGoogleSignIn();

  if (Platform.OS === "android") {
    await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true
    });
  }

  const response = await GoogleSignin.signIn();

  if (response.type === "cancelled") {
    return { cancelled: true };
  }

  if (!response.data.idToken) {
    throw new Error("Google did not return an ID token. Please try again.");
  }

  const tokens = await GoogleSignin.getTokens();

  const { error } = await getSupabaseClient().auth.signInWithIdToken({
    provider: "google",
    token: response.data.idToken,
    access_token: tokens.accessToken
  });

  if (error) {
    throw error;
  }

  return { cancelled: false };
}

// Dev-only bypass: sign in with a Supabase email/password test account so the
// rest of the app can be exercised with a real session (RLS/data all work)
// while native Google/Apple sign-in is being fixed. Stripped from prod by the
// __DEV__ guard in hasDevTestLogin() and by the button only rendering in dev.
export async function signInWithDevTestAccount() {
  if (!hasDevTestLogin()) {
    throw new Error(
      "Dev test login is not configured. Set EXPO_PUBLIC_DEV_TEST_EMAIL and EXPO_PUBLIC_DEV_TEST_PASSWORD in .env."
    );
  }

  const supabase = getSupabaseClient();
  const credentials = {
    email: env.devTestEmail,
    password: env.devTestPassword
  };

  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (!error) {
    return;
  }

  // First run: the user may not exist yet. Try to create it. This only yields
  // a usable session if email confirmation is disabled for the project.
  const isInvalidLogin = error.message.toLowerCase().includes("invalid login");

  if (!isInvalidLogin) {
    throw error;
  }

  const { data, error: signUpError } = await supabase.auth.signUp(credentials);

  if (signUpError) {
    throw signUpError;
  }

  if (!data.session) {
    throw new Error(
      "Created the test user, but Supabase requires email confirmation. Disable confirmation, or add a confirmed user in Authentication → Users, then retry."
    );
  }
}

export async function signOutOfNativeProviders() {
  try {
    if (!googleConfigured) {
      return;
    }

    const { GoogleSignin } = await getGoogleSignInModule();

    if (googleConfigured || GoogleSignin.hasPreviousSignIn()) {
      await GoogleSignin.signOut();
    }
  } catch {
    // Supabase sign-out is the source of truth. Native provider cleanup is best-effort.
  }
}
