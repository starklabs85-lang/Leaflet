import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import * as AppleAuthentication from "expo-apple-authentication";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View
} from "react-native";

import { BrandMark } from "@/components/illustrations/BrandMark";
import { PlaceholderScreen } from "@/components/PlaceholderScreen";
import { PressableScale } from "@/components/ui/PressableScale";
import { LEGAL_ROUTES } from "@/constants/legal";
import { theme } from "@/constants/theme";
import {
  ANALYTICS_TAPS,
  trackTap
} from "@/lib/analytics/firebaseAnalytics";
import { useAuth } from "@/providers/AuthProvider";

type SignInContentProps = {
  body: string;
  eyebrow?: string;
  footer?: ReactNode;
  title: string;
};

export function SignInContent({
  body,
  eyebrow = "Fernly",
  footer,
  title
}: SignInContentProps) {
  const auth = useAuth();
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const isMissingConfig = auth.status === "missing-config";
  const isAuthDisabled = auth.isLoading || isMissingConfig;
  const analyticsSurface =
    eyebrow === "Fernly" ? "public_sign_in" : "onboarding_sign_in";

  useEffect(() => {
    AppleAuthentication.isAvailableAsync()
      .then(setIsAppleAvailable)
      .catch(() => setIsAppleAvailable(false));
  }, []);

  useEffect(() => {
    if (auth.errorMessage) {
      Alert.alert("Fernly sign-in", getFriendlyAuthError(auth.errorMessage), [
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

  function handleAppleSignIn() {
    void trackTap(ANALYTICS_TAPS.SIGN_IN_APPLE_BUTTON, {
      surface: analyticsSurface
    });
    void auth.signInWithApple();
  }

  return (
    <PlaceholderScreen body={body} eyebrow={eyebrow} illustration={hero} title={title}>
      {isAppleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={theme.radius.lg}
          onPress={isAuthDisabled ? () => undefined : handleAppleSignIn}
          style={[styles.appleButton, isAuthDisabled && styles.disabled]}
        />
      ) : null}

      <PressableScale
        accessibilityLabel="Continue with Google"
        accessibilityRole="button"
        analytics={{
          tapName: ANALYTICS_TAPS.SIGN_IN_GOOGLE_BUTTON,
          params: { surface: analyticsSurface }
        }}
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
        By continuing, you agree to Fernly's Terms, Privacy Policy, and
        Standard EULA.
      </Text>

      <View style={styles.legalRow}>
        <PressableScale
          accessibilityLabel="Open Privacy Policy"
          accessibilityRole="link"
          analytics={{
            tapName: ANALYTICS_TAPS.LEGAL_PRIVACY_LINK,
            params: { surface: analyticsSurface }
          }}
          haptic={false}
          onPress={() => router.push(LEGAL_ROUTES.privacy as never)}
          style={styles.legalLink}
        >
          <Text style={styles.legalLinkText}>Privacy Policy</Text>
        </PressableScale>
        <PressableScale
          accessibilityLabel="Open Standard EULA"
          accessibilityRole="link"
          analytics={{
            tapName: ANALYTICS_TAPS.LEGAL_EULA_LINK,
            params: { surface: analyticsSurface }
          }}
          haptic={false}
          onPress={() => router.push(LEGAL_ROUTES.eula as never)}
          style={styles.legalLink}
        >
          <Text style={styles.legalLinkText}>Standard EULA</Text>
        </PressableScale>
        <PressableScale
          accessibilityLabel="Open Terms of Service"
          accessibilityRole="link"
          analytics={{
            tapName: ANALYTICS_TAPS.LEGAL_TERMS_LINK,
            params: { surface: analyticsSurface }
          }}
          haptic={false}
          onPress={() => router.push(LEGAL_ROUTES.terms as never)}
          style={styles.legalLink}
        >
          <Text style={styles.legalLinkText}>Terms</Text>
        </PressableScale>
      </View>

      {isMissingConfig && auth.errorMessage ? (
        <Text selectable style={styles.configErrorText}>
          {getFriendlyAuthError(auth.errorMessage)}
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
    normalized.includes("developer_error") ||
    normalized.includes("code:") ||
    normalized.includes("android oauth")
  ) {
    return message;
  }

  if (
    normalized.includes("email or password") ||
    normalized.includes("confirm your email") ||
    normalized.includes("account already exists") ||
    normalized.includes("stronger password") ||
    normalized.includes("account creation") ||
    normalized.includes("too many sign-in attempts") ||
    normalized.includes("could not reach the sign-in service")
  ) {
    return message;
  }

  if (
    normalized.includes("network") ||
    normalized.includes("fetch") ||
    normalized.includes("timeout")
  ) {
    return "Fernly could not reach the sign-in service. Check your connection and try again.";
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
  emailPanel: {
    gap: theme.spacing.md,
    width: "100%"
  },
  modeSwitch: {
    backgroundColor: theme.colors.leafMuted,
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    padding: theme.spacing.xs,
    width: "100%"
  },
  modeButton: {
    alignItems: "center",
    borderRadius: theme.radius.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: theme.spacing.md
  },
  modeButtonActive: {
    backgroundColor: theme.colors.white
  },
  modeButtonText: {
    color: theme.colors.moss,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.caption
  },
  modeButtonTextActive: {
    color: theme.colors.forest
  },
  input: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.colors.ink,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.body,
    minHeight: 52,
    paddingHorizontal: theme.spacing.md,
    width: "100%"
  },
  emailButton: {
    alignItems: "center",
    backgroundColor: theme.colors.forest,
    borderRadius: theme.radius.lg,
    height: 54,
    justifyContent: "center",
    width: "100%"
  },
  emailButtonText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.body
  },
  formMessage: {
    ...theme.text.caption,
    color: theme.colors.moss,
    lineHeight: 18,
    textAlign: "center"
  },
  formMessageError: {
    color: theme.colors.terra,
    fontFamily: theme.typography.fontFamily.bodyBold
  },
  oauthDivider: {
    ...theme.text.caption,
    color: theme.colors.moss,
    marginVertical: theme.spacing.md,
    textAlign: "center"
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
  helperText: {
    ...theme.text.caption,
    lineHeight: 18,
    marginTop: theme.spacing.md,
    textAlign: "center"
  },
  legalRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
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
