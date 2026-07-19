import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { PremiumLockedScreen } from "@/components/payments/PremiumLockedScreen";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconChip } from "@/components/ui/IconChip";
import { PlantImage } from "@/components/ui/PlantImage";
import { PressableScale } from "@/components/ui/PressableScale";
import { Screen } from "@/components/ui/Screen";
import { theme } from "@/constants/theme";
import { fetchSpeciesProfile } from "@/lib/api/speciesProfile";
import { useEntitlement } from "@/providers/EntitlementProvider";
import type {
  CareDifficulty,
  SpeciesProfile,
  SpeciesProfileErrorCode,
  ToxicityStatus
} from "@/types/speciesProfile";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; profile: SpeciesProfile }
  | {
      status: "error";
      code: SpeciesProfileErrorCode;
      message: string;
    };

type CareIconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

const CARE_CARDS: {
  key: keyof SpeciesProfile["careProfile"];
  label: string;
  icon: CareIconName;
}[] = [
  { key: "light", label: "Light", icon: "white-balance-sunny" },
  { key: "water", label: "Water", icon: "water-outline" },
  { key: "humidity", label: "Humidity", icon: "weather-fog" },
  { key: "temperature", label: "Temperature", icon: "thermometer" },
  { key: "soil", label: "Soil", icon: "layers-outline" },
  { key: "feeding", label: "Feeding", icon: "sprout-outline" }
];

export default function SpeciesInfoScreen() {
  const { isPremium } = useEntitlement();

  if (!isPremium) {
    return (
      <PremiumLockedScreen
        title="Care info requires Premium"
        message="Plant identification, detailed species profiles, and care guidance are included with Premium."
        icon="book-open-variant"
      />
    );
  }

  return <PremiumSpeciesInfoScreen />;
}

function PremiumSpeciesInfoScreen() {
  const params = useLocalSearchParams<{ speciesId?: string | string[] }>();
  const speciesId = Array.isArray(params.speciesId)
    ? params.speciesId[0]
    : params.speciesId;
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  const loadProfile = useCallback(async () => {
    setLoadState({ status: "loading" });

    const result = await fetchSpeciesProfile(speciesId);

    if (!result.ok) {
      setLoadState({
        status: "error",
        code: result.code,
        message: result.message
      });
      return;
    }

    setLoadState({
      status: "ready",
      profile: result.profile
    });
  }, [speciesId]);

  useEffect(() => {
    let isMounted = true;

    setLoadState({ status: "loading" });

    fetchSpeciesProfile(speciesId).then((result) => {
      if (!isMounted) {
        return;
      }

      if (!result.ok) {
        setLoadState({
          status: "error",
          code: result.code,
          message: result.message
        });
        return;
      }

      setLoadState({
        status: "ready",
        profile: result.profile
      });
    });

    return () => {
      isMounted = false;
    };
  }, [speciesId]);

  if (loadState.status === "loading") {
    return (
      <Screen contentContainerStyle={styles.stateContent}>
        <ActivityIndicator color={theme.colors.forest} size="large" />
        <Text style={styles.stateTitle}>Loading plant profile</Text>
        <Text style={styles.stateText}>Reading cached care information.</Text>
      </Screen>
    );
  }

  if (loadState.status === "error") {
    return (
      <Screen contentContainerStyle={styles.stateContent}>
        <IconChip
          background={theme.colors.blush}
          color={theme.colors.terra}
          icon={getStateIcon(loadState.code)}
          size={72}
        />
        <Text style={styles.stateTitle}>{getStateTitle(loadState.code)}</Text>
        <Text style={styles.stateText}>{loadState.message}</Text>
        <View style={styles.stateActions}>
          {loadState.code === "network_error" ? (
            <Button
              accessibilityLabel="Retry loading plant profile"
              icon="refresh"
              label="Try again"
              onPress={loadProfile}
            />
          ) : null}
          <Button
            accessibilityLabel="Go back"
            icon="arrow-left"
            label="Go back"
            onPress={() => router.back()}
            variant="secondary"
          />
        </View>
      </Screen>
    );
  }

  return <SpeciesProfileView profile={loadState.profile} />;
}

function SpeciesProfileView({ profile }: { profile: SpeciesProfile }) {
  const practicalCare = useMemo(() => getPracticalCare(profile), [profile]);

  return (
    <Screen footer={<SpeciesActionBar profile={profile} />}>
      <PressableScale
        accessibilityLabel="Go back"
        accessibilityRole="button"
        haptic={false}
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <MaterialCommunityIcons
          color={theme.colors.forest}
          name="chevron-left"
          size={24}
        />
        <Text style={styles.backText}>Back</Text>
      </PressableScale>

      <PlantImage
        accessibilityLabel={`${profile.commonName} photo`}
        fallbackIcon="sprout"
        iconSize={72}
        style={styles.heroImage}
        uri={profile.imageUrl}
      />
      <Text style={styles.commonName}>{profile.commonName}</Text>
      <Text style={styles.scientificName}>
        {profile.scientificName ?? "Scientific name unavailable"}
      </Text>
      <View style={styles.badgeRow}>
        <DifficultyBadge difficulty={profile.careProfile.difficulty} />
        <ToxicityBadge status={profile.careProfile.toxicityStatus} />
      </View>
      <Text style={styles.toxicityDetail}>{profile.careProfile.toxicity}</Text>

      {profile.careProfile.toxicityStatus === "toxic" ? (
        <View style={styles.warningBanner}>
          <MaterialCommunityIcons
            color={theme.colors.terra}
            name="alert-outline"
            size={22}
          />
          <Text style={styles.warningText}>{profile.careProfile.toxicity}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Care basics</Text>
      <View style={styles.careGrid}>
        {CARE_CARDS.map((card) => (
          <CareCard
            icon={card.icon}
            instruction={String(profile.careProfile[card.key])}
            key={card.key}
            label={card.label}
          />
        ))}
      </View>

      <Section title="Description">
        <Text style={styles.bodyText}>
          {profile.description ??
            "This species profile was created from a scan result. More detail can be added as the profile improves."}
        </Text>
      </Section>

      <Section title="Practical care">
        {practicalCare.map((item) => (
          <View key={item.title} style={styles.careLine}>
            <Text style={styles.careLineTitle}>{item.title}</Text>
            <Text style={styles.bodyText}>{item.body}</Text>
          </View>
        ))}
      </Section>
    </Screen>
  );
}

function SpeciesActionBar({ profile }: { profile: SpeciesProfile }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.actionBar, { paddingBottom: insets.bottom + theme.spacing.md }]}>
      {profile.alreadySaved ? (
        <>
          <View style={styles.savedStatus}>
            <MaterialCommunityIcons
              color={theme.colors.leaf}
              name="check-circle"
              size={20}
            />
            <Text style={styles.savedStatusText}>Already in your collection</Text>
          </View>
          <Button
            accessibilityLabel="Open plant collection"
            icon="sprout"
            label="Open collection"
            onPress={() => router.push("/(auth)/(tabs)/plants")}
            variant="secondary"
          />
        </>
      ) : (
        <Button
          accessibilityLabel={`Add ${profile.commonName} to my plants`}
          gradient
          icon="plus"
          label="Add to my plants"
          onPress={() =>
            router.push({
              pathname: "/(auth)/plants/save" as never,
              params: { speciesId: profile.id }
            })
          }
        />
      )}
    </View>
  );
}

function CareCard({
  icon,
  instruction,
  label
}: {
  icon: CareIconName;
  instruction: string;
  label: string;
}) {
  return (
    <Card style={styles.careCard}>
      <IconChip icon={icon} size={44} />
      <Text style={styles.careLabel}>{label}</Text>
      <Text style={styles.careInstruction}>{instruction}</Text>
    </Card>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: CareDifficulty }) {
  const badge = getDifficultyBadge(difficulty);

  return <Badge icon="speedometer" label={badge.label} tone={badge.tone} />;
}

function ToxicityBadge({ status }: { status: ToxicityStatus }) {
  const badge = getToxicityBadge(status);

  return <Badge icon={badge.icon} label={badge.label} tone={badge.tone} />;
}

function Section({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function getDifficultyBadge(difficulty: CareDifficulty): {
  label: string;
  tone: BadgeTone;
} {
  switch (difficulty) {
    case "easy":
      return { label: "Easy care", tone: "healthy" };
    case "moderate":
      return { label: "Moderate", tone: "attention" };
    case "hard":
      return { label: "Hard", tone: "sick" };
    default:
      return { label: "Difficulty unknown", tone: "neutral" };
  }
}

function getToxicityBadge(status: ToxicityStatus): {
  label: string;
  icon: CareIconName;
  tone: BadgeTone;
} {
  switch (status) {
    case "safe":
      return { label: "Pet safe", icon: "shield-check-outline", tone: "healthy" };
    case "toxic":
      return { label: "Toxic", icon: "alert-outline", tone: "sick" };
    default:
      return { label: "Toxicity unknown", icon: "shield-outline", tone: "neutral" };
  }
}

function getPracticalCare(profile: SpeciesProfile) {
  return [
    {
      title: "Placement",
      body: profile.careProfile.light
    },
    {
      title: "Routine",
      body: `${profile.careProfile.water} ${profile.careProfile.feeding}`
    },
    {
      title: "Watch-outs",
      body: profile.careProfile.toxicity
    }
  ];
}

function getStateTitle(code: SpeciesProfileErrorCode) {
  switch (code) {
    case "missing_species_id":
      return "Plant info unavailable";
    case "not_found":
      return "Species not found";
    case "malformed_care_profile":
      return "Care profile unavailable";
    case "unauthorized":
      return "Session required";
    default:
      return "Could not load profile";
  }
}

function getStateIcon(code: SpeciesProfileErrorCode): CareIconName {
  switch (code) {
    case "not_found":
      return "magnify-close";
    case "malformed_care_profile":
      return "file-alert-outline";
    case "unauthorized":
      return "lock-outline";
    default:
      return "wifi-alert";
  }
}

const styles = StyleSheet.create({
  stateContent: {
    alignItems: "center",
    flexGrow: 1,
    gap: theme.spacing.sm,
    justifyContent: "center"
  },
  stateTitle: {
    ...theme.text.title,
    marginTop: theme.spacing.md,
    textAlign: "center"
  },
  stateText: {
    ...theme.text.body,
    color: theme.colors.moss,
    marginBottom: theme.spacing.md,
    textAlign: "center"
  },
  stateActions: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
    width: "100%"
  },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    minHeight: 44
  },
  backText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.body
  },
  heroImage: {
    aspectRatio: 1.2,
    borderRadius: theme.radius.card,
    marginTop: theme.spacing.sm,
    width: "100%"
  },
  commonName: {
    ...theme.text.display,
    marginTop: theme.spacing.lg
  },
  scientificName: {
    color: theme.colors.moss,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.body,
    fontStyle: "italic",
    lineHeight: 24,
    marginTop: theme.spacing.xs
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg
  },
  toxicityDetail: {
    ...theme.text.caption,
    marginTop: theme.spacing.sm
  },
  warningBanner: {
    alignItems: "flex-start",
    backgroundColor: theme.colors.blush,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
    padding: theme.spacing.lg
  },
  warningText: {
    color: theme.colors.ink,
    flex: 1,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.body,
    lineHeight: 23
  },
  section: {
    marginTop: theme.spacing.xl
  },
  sectionTitle: {
    ...theme.text.heading,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.xl
  },
  careGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md
  },
  careCard: {
    minHeight: 168,
    width: "47.5%"
  },
  careLabel: {
    ...theme.text.bodyStrong,
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.md
  },
  careInstruction: {
    ...theme.text.caption,
    lineHeight: 18
  },
  bodyText: {
    ...theme.text.body
  },
  careLine: {
    marginBottom: theme.spacing.lg
  },
  careLineTitle: {
    ...theme.text.bodyStrong,
    marginBottom: theme.spacing.xs
  },
  actionBar: {
    backgroundColor: theme.colors.paper,
    borderTopColor: theme.colors.line,
    borderTopWidth: 1,
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md
  },
  savedStatus: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center"
  },
  savedStatusText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.body
  }
});
