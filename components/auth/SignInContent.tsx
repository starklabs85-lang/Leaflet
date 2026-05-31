import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import * as AppleAuthentication from "expo-apple-authentication";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  View
} from "react-native";

import { BrandMark } from "@/components/illustrations/BrandMark";
import { PlaceholderScreen } from "@/components/PlaceholderScreen";
import { PressableScale } from "@/components/ui/PressableScale";
import { LEGAL_ROUTES } from "@/constants/legal";
import { theme } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";

type SignInContentProps = {
  body: string;
  eyebrow?: string;
  footer?: ReactNode;
  title: string;
};

export function SignInContent({
  body,
  eyebrow = "Leaflet",
  footer,
  title
}: SignInContentProps) {
  const auth = useAuth();
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const isMissingConfig = auth.status === "missing-config";
  const isAuthDisabled = auth.isLoading || isMissingConfig;

  useEffect(() => {
    AppleAuthentication.isAvailableAsync()
      .then(setIsAppleAvailable)
      .catch(() => setIsAppleAvailable(false));
  }, []);

  useEffect(() => {
    if (auth.errorMessage) {
      Alert.alert("Sign-in failed", getFriendlyAuthError(auth.errorMessage), [
        { text: "OK", onPress: auth.clearError }
      ]);
    }
  }, [auth.clearError, auth.errorMessage]);

  const hero = (
    <LinearGradient
      colors={theme.gradient.brand}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={styles.heroBadge}
    >
      <BrandMark color={theme.colors.white} size={56} veinColor={theme.colors.canopy} />
    </LinearGradient>
  );

  return (
    <PlaceholderScreen body={body} eyebrow={eyebrow} illustration={hero} title={title}>
      {isAppleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={theme.radius.lg}
          onPress={isAuthDisabled ? () => undefined : auth.signInWithApple}
          style={[styles.appleButton, isAuthDisabled && styles.disabled]}
        />
      ) : (
        <View style={styles.unavailableCard}>
          <Text style={styles.unavailableText}>
            Apple sign-in is available on supported iOS devices.
          </Text>
        </View>
      )}

      <PressableScale
        accessibilityLabel="Continue with Google"
        accessibilityRole="button"
        disabled={isAuthDisabled}
        onPress={auth.signInWithGoogle}
        style={[styles.googleButton, isAuthDisabled && styles.disabled]}
      >
        {auth.activeProvider === "google" ? (
          <ActivityIndicator color={theme.colors.forest} />
        ) : (
          <>
            <MaterialCommunityIcons
              color={theme.colors.forest}
              name="google"
              size={20}
            />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </>
        )}
      </PressableScale>

      <Text style={styles.helperText}>
        By continuing, you agree to Leaflet's Terms and Privacy Policy. Plant
        photos you scan are processed in the cloud with Supabase and OpenAI.
      </Text>

      <View style={styles.legalRow}>
        <PressableScale
          accessibilityLabel="Open Privacy Policy"
          accessibilityRole="link"
          haptic={false}
          onPress={() => router.push(LEGAL_ROUTES.privacy as never)}
          style={styles.legalLink}
        >
          <Text style={styles.legalLinkText}>Privacy Policy</Text>
        </PressableScale>
        <PressableScale
          accessibilityLabel="Open Terms of Service"
          accessibilityRole="link"
          haptic={false}
          onPress={() => router.push(LEGAL_ROUTES.terms as never)}
          style={styles.legalLink}
        >
          <Text style={styles.legalLinkText}>Terms</Text>
        </PressableScale>
      </View>

      <Text style={styles.helperText}>
        No email/password sign-in in the MVP — Apple and Google are handled
        through Supabase Auth.
      </Text>
      {isMissingConfig && auth.errorMessage ? (
        <Text selectable style={styles.configErrorText}>
          {getFriendlyAuthError(auth.errorMessage)}
        </Text>
      ) : null}
      {Platform.OS !== "ios" ? (
        <Text style={styles.helperText}>
          Apple sign-in will appear on supported iOS devices.
        </Text>
      ) : null}
      {footer}
    </PlaceholderScreen>
  );
}

function getFriendlyAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("missing")) {
    return message;
  }

  if (
    normalized.includes("network") ||
    normalized.includes("fetch") ||
    normalized.includes("timeout")
  ) {
    return "Leaflet could not reach the sign-in service. Check your connection and try again.";
  }

  if (normalized.includes("cancel")) {
    return "Sign-in was cancelled.";
  }

  return "Sign-in could not be completed. Please try again.";
}

const styles = StyleSheet.create({
  heroBadge: {
    alignItems: "center",
    borderRadius: 30,
    height: 104,
    justifyContent: "center",
    overflow: "hidden",
    width: 104,
    ...theme.shadow.lifted
  },
  appleButton: {
    height: 54,
    width: "100%"
  },
  googleButton: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: theme.spacing.sm,
    height: 54,
    justifyContent: "center",
    marginTop: theme.spacing.md,
    width: "100%"
  },
  googleButtonText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.body
  },
  unavailableCard: {
    backgroundColor: theme.colors.leafMuted,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md
  },
  unavailableText: {
    ...theme.text.caption,
    lineHeight: 18
  },
  helperText: {
    ...theme.text.caption,
    lineHeight: 18,
    marginTop: theme.spacing.md,
    textAlign: "center"
  },
  legalRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "center",
    marginTop: theme.spacing.md
  },
  legalLink: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: theme.spacing.sm
  },
  legalLinkText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.caption,
    textDecorationLine: "underline"
  },
  configErrorText: {
    color: theme.colors.terra,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.caption,
    lineHeight: 18,
    marginTop: theme.spacing.md,
    textAlign: "center"
  },
  disabled: {
    opacity: 0.6
  }
});
