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
  TextInput,
  View
} from "react-native";

import { BrandMark } from "@/components/illustrations/BrandMark";
import { PlaceholderScreen } from "@/components/PlaceholderScreen";
import { PressableScale } from "@/components/ui/PressableScale";
import { LEGAL_ROUTES } from "@/constants/legal";
import { theme } from "@/constants/theme";
import { hasDevTestLogin } from "@/lib/env";
import { useAuth } from "@/providers/AuthProvider";

type SignInContentProps = {
  body: string;
  eyebrow?: string;
  footer?: ReactNode;
  title: string;
};

type AuthMode = "sign-in" | "sign-up";

export function SignInContent({
  body,
  eyebrow = "Leaflet",
  footer,
  title
}: SignInContentProps) {
  const auth = useAuth();
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formMessageType, setFormMessageType] = useState<"error" | "success">(
    "success"
  );
  const isMissingConfig = auth.status === "missing-config";
  const isAuthDisabled = auth.isLoading || isMissingConfig;
  const isEmailLoading =
    auth.activeProvider === "email-sign-in" ||
    auth.activeProvider === "email-sign-up";
  const isSignUp = authMode === "sign-up";

  useEffect(() => {
    AppleAuthentication.isAvailableAsync()
      .then(setIsAppleAvailable)
      .catch(() => setIsAppleAvailable(false));
  }, []);

  useEffect(() => {
    if (auth.errorMessage) {
      Alert.alert("Leaflet sign-in", getFriendlyAuthError(auth.errorMessage), [
        { text: "OK", onPress: auth.clearError }
      ]);
    }
  }, [auth.clearError, auth.errorMessage]);

  function switchMode(nextMode: AuthMode) {
    setAuthMode(nextMode);
    setConfirmPassword("");
    setFormMessage(null);
    auth.clearError();
  }

  async function submitEmailPassword() {
    const trimmedEmail = email.trim();
    const validationError = validateEmailPasswordForm({
      confirmPassword,
      email: trimmedEmail,
      isSignUp,
      password
    });

    if (validationError) {
      setFormMessageType("error");
      setFormMessage(validationError);
      return;
    }

    setFormMessage(null);
    auth.clearError();

    if (isSignUp) {
      const result = await auth.signUpWithEmailPassword({
        email: trimmedEmail,
        password
      });

      if (result?.status === "confirmation-required") {
        setPassword("");
        setConfirmPassword("");
        setFormMessageType("success");
        setFormMessage(`Check ${result.email} to confirm your Leaflet account.`);
      }
      return;
    }

    await auth.signInWithEmailPassword({
      email: trimmedEmail,
      password
    });
  }

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
      <View style={styles.emailPanel}>
        <View style={styles.modeSwitch}>
          <PressableScale
            accessibilityLabel="Switch to email sign-in"
            accessibilityRole="button"
            accessibilityState={{ selected: authMode === "sign-in" }}
            disabled={isAuthDisabled}
            haptic={false}
            onPress={() => switchMode("sign-in")}
            style={[
              styles.modeButton,
              authMode === "sign-in" ? styles.modeButtonActive : null
            ]}
          >
            <Text
              style={[
                styles.modeButtonText,
                authMode === "sign-in" ? styles.modeButtonTextActive : null
              ]}
            >
              Sign in
            </Text>
          </PressableScale>
          <PressableScale
            accessibilityLabel="Switch to create account"
            accessibilityRole="button"
            accessibilityState={{ selected: authMode === "sign-up" }}
            disabled={isAuthDisabled}
            haptic={false}
            onPress={() => switchMode("sign-up")}
            style={[
              styles.modeButton,
              authMode === "sign-up" ? styles.modeButtonActive : null
            ]}
          >
            <Text
              style={[
                styles.modeButtonText,
                authMode === "sign-up" ? styles.modeButtonTextActive : null
              ]}
            >
              Create account
            </Text>
          </PressableScale>
        </View>

        <TextInput
          accessibilityLabel="Email address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          editable={!isAuthDisabled}
          inputMode="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email address"
          placeholderTextColor={theme.colors.moss}
          returnKeyType="next"
          style={[styles.input, isAuthDisabled && styles.disabled]}
          textContentType="emailAddress"
          value={email}
        />
        <TextInput
          accessibilityLabel="Password"
          autoCapitalize="none"
          autoComplete={isSignUp ? "new-password" : "password"}
          editable={!isAuthDisabled}
          onChangeText={setPassword}
          onSubmitEditing={isSignUp ? () => undefined : submitEmailPassword}
          placeholder="Password"
          placeholderTextColor={theme.colors.moss}
          returnKeyType={isSignUp ? "next" : "done"}
          secureTextEntry
          style={[styles.input, isAuthDisabled && styles.disabled]}
          textContentType={isSignUp ? "newPassword" : "password"}
          value={password}
        />
        {isSignUp ? (
          <TextInput
            accessibilityLabel="Confirm password"
            autoCapitalize="none"
            autoComplete="new-password"
            editable={!isAuthDisabled}
            onChangeText={setConfirmPassword}
            onSubmitEditing={submitEmailPassword}
            placeholder="Confirm password"
            placeholderTextColor={theme.colors.moss}
            returnKeyType="done"
            secureTextEntry
            style={[styles.input, isAuthDisabled && styles.disabled]}
            textContentType="newPassword"
            value={confirmPassword}
          />
        ) : null}

        <PressableScale
          accessibilityLabel={isSignUp ? "Create Leaflet account" : "Sign in with email"}
          accessibilityRole="button"
          accessibilityState={{ busy: isEmailLoading, disabled: isAuthDisabled }}
          disabled={isAuthDisabled}
          onPress={submitEmailPassword}
          style={[styles.emailButton, isAuthDisabled && styles.disabled]}
        >
          {isEmailLoading ? (
            <ActivityIndicator color={theme.colors.white} />
          ) : (
            <Text style={styles.emailButtonText}>
              {isSignUp ? "Create account" : "Sign in with email"}
            </Text>
          )}
        </PressableScale>

        {formMessage ? (
          <Text
            style={[
              styles.formMessage,
              formMessageType === "error" ? styles.formMessageError : null
            ]}
          >
            {formMessage}
          </Text>
        ) : (
          <Text style={styles.formMessage}>
            New accounts may require email confirmation before sign-in.
          </Text>
        )}
      </View>

      <Text style={styles.oauthDivider}>Or continue with</Text>

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

      {hasDevTestLogin() ? (
        <PressableScale
          accessibilityLabel="Dev test login"
          accessibilityRole="button"
          disabled={isAuthDisabled}
          onPress={auth.signInWithDevTest}
          style={[styles.devButton, isAuthDisabled && styles.disabled]}
        >
          {auth.activeProvider === "dev" ? (
            <ActivityIndicator color={theme.colors.white} />
          ) : (
            <Text style={styles.devButtonText}>Dev test login (bypass OAuth)</Text>
          )}
        </PressableScale>
      ) : null}

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

function validateEmailPasswordForm({
  confirmPassword,
  email,
  isSignUp,
  password
}: {
  confirmPassword: string;
  email: string;
  isSignUp: boolean;
  password: string;
}) {
  if (!email) {
    return "Enter your email address.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Enter a valid email address.";
  }

  if (!password) {
    return "Enter your password.";
  }

  if (isSignUp && password.length < 6) {
    return "Use at least 6 characters for your password.";
  }

  if (isSignUp && password !== confirmPassword) {
    return "Passwords do not match.";
  }

  return null;
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
  devButton: {
    alignItems: "center",
    backgroundColor: theme.colors.forest,
    borderRadius: theme.radius.lg,
    height: 54,
    justifyContent: "center",
    marginTop: theme.spacing.md,
    width: "100%"
  },
  devButtonText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.body
  },
  disabled: {
    opacity: 0.6
  }
});
