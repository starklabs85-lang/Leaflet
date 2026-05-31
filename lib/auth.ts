import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes
} from "@react-native-google-signin/google-signin";

import { env, getGoogleConfigIssue, hasGoogleConfig } from "@/lib/env";
import { getSupabaseClient } from "@/lib/supabase";

let googleConfigured = false;

async function createNoncePair() {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );

  return { rawNonce, hashedNonce };
}

function configureGoogleSignIn() {
  if (googleConfigured) {
    return;
  }

  if (!hasGoogleConfig()) {
    throw new Error(getGoogleConfigIssue() ?? "Google sign-in is not configured.");
  }

  GoogleSignin.configure({
    webClientId: env.googleWebClientId,
    iosClientId: env.googleIosClientId || undefined,
    scopes: ["profile", "email"]
  });

  googleConfigured = true;
}

export function isUserCancelledAuthError(error: unknown) {
  if (isErrorWithCode(error)) {
    return error.code === statusCodes.SIGN_IN_CANCELLED;
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
  configureGoogleSignIn();

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

export async function signOutOfNativeProviders() {
  try {
    if (googleConfigured || GoogleSignin.hasPreviousSignIn()) {
      await GoogleSignin.signOut();
    }
  } catch {
    // Supabase sign-out is the source of truth. Native provider cleanup is best-effort.
  }
}
