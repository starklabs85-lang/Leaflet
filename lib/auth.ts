import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

import { env, getGoogleConfigIssue, hasGoogleConfig } from "@/lib/env";
import {
  completeNativeIdentitySignIn,
  type NativeIdTokenCredentials
} from "@/lib/nativeIdentityFlow";
import { getSupabaseClient } from "@/lib/supabase";
import { getAppsFlyerUidForDeletion } from "@/lib/measurement/runtime";

type GoogleSignInModule = typeof import("@react-native-google-signin/google-signin");
type DeleteAccountResponse =
  | { ok: true }
  | { ok: false; error?: { code?: string; message?: string } };

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
      "Google sign-in requires a Fernly development build. Open the app with the Fernly dev client instead of Expo Go."
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

  const identityResult = await linkOrSignInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce: rawNonce
  });

  return { cancelled: false, identityResult };
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

  const identityResult = await linkOrSignInWithIdToken({
    provider: "google",
    token: response.data.idToken,
    access_token: tokens.accessToken
  });

  return { cancelled: false, identityResult };
}

async function linkOrSignInWithIdToken(credentials: NativeIdTokenCredentials) {
  const supabase = getSupabaseClient();

  return completeNativeIdentitySignIn(
    {
      getSession: () => supabase.auth.getSession(),
      linkIdentity: (nextCredentials) =>
        supabase.auth.linkIdentity(nextCredentials),
      signInWithIdToken: (nextCredentials) =>
        supabase.auth.signInWithIdToken(nextCredentials)
    },
    credentials
  );
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

export async function deleteAccount() {
  const supabase = getSupabaseClient();
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session) {
    throw new Error("Please sign in again before deleting your account.");
  }

  const appsflyerUid = await getAppsFlyerUidForDeletion().catch(() => null);

  const { data, error } = await supabase.functions.invoke<DeleteAccountResponse>(
    "delete-account",
    {
      body: { appsflyerUid }
    }
  );

  if (error) {
    const structured = await parseDeleteAccountError(error);
    throw new Error(
      structured ??
        error.message ??
        "Fernly could not delete your account. Please try again."
    );
  }

  if (!data?.ok) {
    throw new Error(
      data?.error?.message ??
        "Fernly could not delete your account. Please try again."
    );
  }
}

async function parseDeleteAccountError(error: unknown) {
  const context =
    typeof error === "object" && error !== null && "context" in error
      ? (error as { context: unknown }).context
      : null;

  if (!(context instanceof Response)) {
    return null;
  }

  try {
    const payload = (await context.clone().json()) as DeleteAccountResponse;

    if (payload && payload.ok === false && payload.error?.message) {
      return payload.error.message;
    }
  } catch {
    // Body was not the function's JSON error shape; fall through.
  }

  return null;
}
