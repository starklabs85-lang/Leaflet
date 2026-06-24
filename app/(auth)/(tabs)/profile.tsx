import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { User } from "@supabase/supabase-js";

import { Card } from "@/components/ui/Card";
import { GradientHeader } from "@/components/ui/GradientHeader";
import { IconChip } from "@/components/ui/IconChip";
import { PressableScale } from "@/components/ui/PressableScale";
import { Screen } from "@/components/ui/Screen";
import { LEGAL_ROUTES } from "@/constants/legal";
import { theme } from "@/constants/theme";
import {
  clearStoredUserLocation,
  getStoredUserLocation,
  type StoredUserLocation
} from "@/lib/location/userLocation";
import {
  getCareReminderSettings,
  setCareRemindersEnabled,
  type CareReminderSettings
} from "@/lib/notifications/careReminders";
import {
  isWeatherAlertsEnabled,
  setWeatherAlertsEnabled
} from "@/lib/notifications/weatherAlerts";
import { useAuth } from "@/providers/AuthProvider";
import { useEntitlement } from "@/providers/EntitlementProvider";

export default function ProfileScreen() {
  const auth = useAuth();
  const entitlement = useEntitlement();
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [reminderSettings, setReminderSettings] =
    useState<CareReminderSettings | null>(null);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [isUpdatingReminders, setIsUpdatingReminders] = useState(false);
  const [weatherAlertsOn, setWeatherAlertsOn] = useState<boolean | null>(null);
  const [weatherMessage, setWeatherMessage] = useState<string | null>(null);
  const [isUpdatingWeatherAlerts, setIsUpdatingWeatherAlerts] = useState(false);
  const [weatherLocation, setWeatherLocation] =
    useState<StoredUserLocation | null>(null);

  useEffect(() => {
    let isMounted = true;

    getCareReminderSettings().then((settings) => {
      if (isMounted) {
        setReminderSettings(settings);
      }
    });
    isWeatherAlertsEnabled().then((enabled) => {
      if (isMounted) {
        setWeatherAlertsOn(enabled);
      }
    });
    getStoredUserLocation().then((location) => {
      if (isMounted) {
        setWeatherLocation(location);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  async function toggleReminders(enabled: boolean) {
    setIsUpdatingReminders(true);
    setReminderMessage(null);

    const result = await setCareRemindersEnabled(enabled);

    setReminderSettings(result.settings);
    setReminderMessage(
      result.ok
        ? enabled
          ? "Care reminders are on."
          : "Care reminders are off."
        : result.message
    );
    setIsUpdatingReminders(false);
  }

  async function toggleWeatherAlerts(enabled: boolean) {
    setIsUpdatingWeatherAlerts(true);
    setWeatherMessage(null);

    const result = await setWeatherAlertsEnabled(enabled);

    if (result.ok) {
      setWeatherAlertsOn(result.enabled);
      setWeatherMessage(
        result.enabled
          ? "Frost alerts are on. We'll warn you the evening a freeze threatens your plants."
          : "Frost alerts are off."
      );
    } else {
      setWeatherAlertsOn(false);
      setWeatherMessage(result.message);
    }

    setIsUpdatingWeatherAlerts(false);
  }

  async function forgetWeatherLocation() {
    await clearStoredUserLocation();
    setWeatherLocation(null);
    setWeatherMessage("Saved weather location removed.");
  }

  async function restorePurchases() {
    if (isRestoring) {
      return;
    }

    setIsRestoring(true);
    setRestoreMessage(null);

    const outcome = await entitlement.restore();

    setIsRestoring(false);
    setRestoreMessage(
      outcome.status === "restored"
        ? "Your Premium subscription has been restored."
        : outcome.status === "nothing_to_restore"
          ? "No previous purchases were found for this account."
          : outcome.message
    );
  }

  return (
    <Screen
      contentContainerStyle={styles.content}
      header={<ProfileHeader user={auth.user} />}
    >
      <Text style={styles.sectionLabel}>Membership</Text>
      <Card padded={false} style={styles.card}>
        <SettingsLinkRow
          icon={entitlement.isPremium ? "leaf-circle" : "leaf-circle-outline"}
          onPress={() => router.push("/(auth)/premium" as never)}
          title={
            entitlement.isPremium ? "Fernly Premium active" : "Upgrade to Premium"
          }
        />
        <View style={styles.divider} />
        <SettingsLinkRow
          icon="restore"
          onPress={restorePurchases}
          title={isRestoring ? "Checking purchases..." : "Restore purchases"}
        />
      </Card>
      {restoreMessage ? (
        <Text style={styles.reminderMessage}>{restoreMessage}</Text>
      ) : null}

      <Text style={styles.sectionLabel}>Preferences</Text>
      <Card style={styles.card}>
        <View style={styles.settingRow}>
          <IconChip icon="bell-ring-outline" size={44} />
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>Care reminders</Text>
            <Text style={styles.settingText}>
              9 AM local alerts for active care tasks.
            </Text>
          </View>
          {reminderSettings ? (
            <Switch
              accessibilityLabel="Toggle care reminders"
              disabled={isUpdatingReminders}
              onValueChange={toggleReminders}
              thumbColor={theme.colors.white}
              trackColor={{ false: theme.colors.line, true: theme.colors.leaf }}
              value={reminderSettings.enabled}
            />
          ) : (
            <ActivityIndicator color={theme.colors.forest} />
          )}
        </View>
        {reminderSettings ? (
          <Text style={styles.settingMeta}>
            Permission: {reminderSettings.permissionStatus} · Scheduled:{" "}
            {reminderSettings.scheduledCount}
          </Text>
        ) : null}
        {reminderMessage ? (
          <Text style={styles.reminderMessage}>{reminderMessage}</Text>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <View style={styles.settingRow}>
          <IconChip icon="snowflake-alert" size={44} />
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>Frost alerts</Text>
            <Text style={styles.settingText}>
              An evening warning when frost threatens your outdoor plants.
            </Text>
          </View>
          {weatherAlertsOn === null ? (
            <ActivityIndicator color={theme.colors.forest} />
          ) : (
            <Switch
              accessibilityLabel="Toggle frost alerts"
              disabled={isUpdatingWeatherAlerts}
              onValueChange={toggleWeatherAlerts}
              thumbColor={theme.colors.white}
              trackColor={{ false: theme.colors.line, true: theme.colors.leaf }}
              value={weatherAlertsOn}
            />
          )}
        </View>
        <Text style={styles.settingMeta}>
          {weatherLocation
            ? `Weather location: ${weatherLocation.label ?? "approximate coordinates"} (${
                weatherLocation.source === "gps" ? "from device" : "set manually"
              }). Kept coarse (~1 km) and used only to fetch weather.`
            : "No weather location saved. Set one from the dashboard's weather card."}
        </Text>
        {weatherLocation ? (
          <PressableScale
            accessibilityLabel="Remove saved weather location"
            accessibilityRole="button"
            haptic={false}
            onPress={forgetWeatherLocation}
            style={styles.inlineLink}
          >
            <Text style={styles.inlineLinkText}>Remove saved location</Text>
          </PressableScale>
        ) : null}
        {weatherMessage ? (
          <Text style={styles.reminderMessage}>{weatherMessage}</Text>
        ) : null}
      </Card>

      <Text style={styles.sectionLabel}>About</Text>
      <Card padded={false} style={styles.card}>
        <SettingsLinkRow
          icon="shield-account-outline"
          onPress={() => router.push(LEGAL_ROUTES.privacy as never)}
          title="Privacy Policy"
        />
        <View style={styles.divider} />
        <SettingsLinkRow
          icon="file-document-outline"
          onPress={() => router.push(LEGAL_ROUTES.terms as never)}
          title="Terms of Service"
        />
      </Card>

      {auth.errorMessage ? (
        <Text style={styles.errorText}>{auth.errorMessage}</Text>
      ) : null}

      <PressableScale
        accessibilityLabel="Sign out of Fernly"
        accessibilityRole="button"
        accessibilityState={{ disabled: auth.isLoading }}
        disabled={auth.isLoading}
        onPress={auth.signOut}
        style={[styles.signOutButton, auth.isLoading ? styles.disabled : null]}
      >
        {auth.isLoading ? (
          <ActivityIndicator color={theme.colors.terra} />
        ) : (
          <>
            <MaterialCommunityIcons
              color={theme.colors.terra}
              name="logout-variant"
              size={20}
            />
            <Text style={styles.signOutText}>Sign out</Text>
          </>
        )}
      </PressableScale>

      <Text style={styles.versionText}>Fernly Beta</Text>
    </Screen>
  );
}

function ProfileHeader({ user }: { user: User | null }) {
  const name = getDisplayName(user);
  const email = user?.email ?? "Signed-in user";
  const initial = getInitial(name, email);

  return (
    <GradientHeader>
      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.headerName}>
            {name}
          </Text>
          <Text numberOfLines={1} style={styles.headerEmail}>
            {email}
          </Text>
        </View>
      </View>
    </GradientHeader>
  );
}

function SettingsLinkRow({
  icon,
  onPress,
  title
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  title: string;
}) {
  return (
    <PressableScale
      accessibilityLabel={`Open ${title}`}
      accessibilityRole="link"
      haptic={false}
      onPress={onPress}
      style={styles.linkRow}
    >
      <IconChip icon={icon} size={44} />
      <Text style={styles.linkTitle}>{title}</Text>
      <MaterialCommunityIcons
        color={theme.colors.moss}
        name="chevron-right"
        size={22}
      />
    </PressableScale>
  );
}

function getDisplayName(user: User | null) {
  const metadata = user?.user_metadata as Record<string, unknown> | undefined;
  const fullName =
    typeof metadata?.full_name === "string"
      ? metadata.full_name
      : typeof metadata?.name === "string"
        ? metadata.name
        : null;

  return fullName?.trim() || user?.email?.split("@")[0] || "Plant parent";
}

function getInitial(name: string, email: string) {
  const source = name.trim() || email.trim();

  return source.charAt(0).toUpperCase() || "🌱";
}

const styles = StyleSheet.create({
  content: {
    paddingTop: theme.spacing.xl
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: theme.radius.pill,
    height: 64,
    justifyContent: "center",
    width: 64
  },
  avatarText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontFamily.displayBold,
    fontSize: 28
  },
  headerCopy: {
    flex: 1
  },
  headerName: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontFamily.displayBold,
    fontSize: 24
  },
  headerEmail: {
    color: "rgba(255,255,255,0.82)",
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 14,
    marginTop: 2
  },
  sectionLabel: {
    ...theme.text.eyebrow,
    color: theme.colors.moss,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.lg
  },
  card: {
    gap: theme.spacing.sm
  },
  settingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md
  },
  settingCopy: {
    flex: 1
  },
  settingTitle: {
    ...theme.text.bodyStrong
  },
  settingText: {
    ...theme.text.caption,
    marginTop: 2
  },
  settingMeta: {
    ...theme.text.caption,
    marginTop: theme.spacing.xs
  },
  reminderMessage: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.caption,
    lineHeight: 18,
    marginTop: theme.spacing.xs
  },
  inlineLink: {
    alignSelf: "flex-start",
    minHeight: 32,
    justifyContent: "center"
  },
  inlineLinkText: {
    color: theme.colors.terra,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.caption
  },
  linkRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    minHeight: 64,
    paddingHorizontal: theme.spacing.lg
  },
  linkTitle: {
    ...theme.text.bodyStrong,
    flex: 1
  },
  divider: {
    backgroundColor: theme.colors.line,
    height: 1,
    marginLeft: 60 + theme.spacing.lg
  },
  errorText: {
    color: theme.colors.terra,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.caption,
    lineHeight: 18,
    marginTop: theme.spacing.md
  },
  signOutButton: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.blush,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    marginTop: theme.spacing.xl,
    minHeight: 54
  },
  signOutText: {
    color: theme.colors.terra,
    fontFamily: theme.typography.fontFamily.bodyBlack,
    fontSize: theme.typography.body
  },
  disabled: {
    opacity: 0.6
  },
  versionText: {
    ...theme.text.caption,
    marginTop: theme.spacing.xl,
    textAlign: "center"
  }
});
