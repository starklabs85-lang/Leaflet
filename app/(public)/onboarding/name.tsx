import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { theme } from "@/constants/theme";
import { normalizeDisplayName } from "@/lib/onboarding/flow";
import { useAuth } from "@/providers/AuthProvider";
import { useOnboarding } from "@/providers/OnboardingProvider";

export default function OnboardingNameScreen() {
  const auth = useAuth();
  const onboarding = useOnboarding();
  const [name, setName] = useState(onboarding.displayName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const normalized = normalizeDisplayName(name);

  async function continueToDashboard() {
    if (!normalized || saving) return;
    setSaving(true);
    setError(null);
    try {
      await auth.ensureAnonymousSession();
      await onboarding.completeWithDisplayName(normalized);
      router.replace("/(auth)/(tabs)/home" as never);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Fernly could not finish setup.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
      <Screen contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>One last thing</Text>
        <Text style={styles.title}>What should Fernly call you?</Text>
        <Text style={styles.body}>This name personalizes your dashboard and stays private.</Text>
        <View style={styles.form}>
          <TextInput
            accessibilityLabel="Your display name"
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={80}
            onChangeText={setName}
            onSubmitEditing={() => void continueToDashboard()}
            placeholder="Your name"
            returnKeyType="done"
            style={styles.input}
            value={name}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            disabled={!normalized || saving}
            gradient
            icon="arrow-right"
            iconPosition="trailing"
            label={saving ? "Preparing your dashboard..." : "Continue to dashboard"}
            loading={saving}
            onPress={continueToDashboard}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: theme.colors.paper, flex: 1 },
  content: { flexGrow: 1, justifyContent: "center" },
  eyebrow: { ...theme.text.eyebrow },
  title: { ...theme.text.display, marginTop: theme.spacing.sm },
  body: { ...theme.text.body, color: theme.colors.moss, marginTop: theme.spacing.md },
  form: { gap: theme.spacing.md, marginTop: theme.spacing.xxl },
  input: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1.5,
    color: theme.colors.ink,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 18,
    minHeight: 58,
    paddingHorizontal: theme.spacing.lg
  },
  error: { ...theme.text.caption, color: theme.colors.terra }
});
