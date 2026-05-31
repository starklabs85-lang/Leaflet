import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { EmptyPlants } from "@/components/illustrations/EmptyPlants";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconChip } from "@/components/ui/IconChip";
import { PlantImage } from "@/components/ui/PlantImage";
import { PressableScale } from "@/components/ui/PressableScale";
import { Screen } from "@/components/ui/Screen";
import { theme } from "@/constants/theme";
import { listUserPlants } from "@/lib/api/plantCollection";
import type { PlantStatus, SavedPlant } from "@/types/plantCollection";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; plants: SavedPlant[] }
  | { status: "error"; message: string };

export default function PlantsScreen() {
  const params = useLocalSearchParams<{ speciesId?: string | string[] }>();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const loadPlants = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoadState({ status: "loading" });
    }

    const result = await listUserPlants();

    if (!result.ok) {
      setLoadState({ status: "error", message: result.message });
      setRefreshing(false);
      return;
    }

    setLoadState({ status: "ready", plants: result.data });
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadPlants();
  }, [loadPlants]);

  useEffect(() => {
    const speciesId = Array.isArray(params.speciesId)
      ? params.speciesId[0]
      : params.speciesId;

    if (speciesId) {
      router.replace({
        pathname: "/(auth)/plants/save" as never,
        params: { speciesId }
      });
    }
  }, [params.speciesId]);

  if (loadState.status === "loading") {
    return (
      <Screen contentContainerStyle={styles.stateContent}>
        <ActivityIndicator color={theme.colors.forest} size="large" />
        <Text style={styles.stateTitle}>Loading your plants</Text>
        <Text style={styles.stateText}>Gathering your collection.</Text>
      </Screen>
    );
  }

  if (loadState.status === "error") {
    return (
      <Screen contentContainerStyle={styles.stateContent}>
        <IconChip
          background={theme.colors.blush}
          color={theme.colors.terra}
          icon="wifi-alert"
          size={72}
        />
        <Text style={styles.stateTitle}>Collection unavailable</Text>
        <Text style={styles.stateText}>{loadState.message}</Text>
        <Button
          accessibilityLabel="Retry loading plant collection"
          icon="refresh"
          label="Try again"
          onPress={() => loadPlants()}
        />
      </Screen>
    );
  }

  const plants = loadState.plants;
  const countText =
    plants.length === 1 ? "1 plant" : `${plants.length} plants`;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          onRefresh={() => loadPlants(true)}
          refreshing={refreshing}
          tintColor={theme.colors.forest}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>My Plants</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Your collection</Text>
          {plants.length > 0 ? (
            <Badge label={countText} tone="info" />
          ) : null}
        </View>
      </View>

      {plants.length === 0 ? (
        <EmptyCollection />
      ) : (
        <View style={styles.list}>
          {plants.map((plant) => (
            <PlantCard key={plant.id} plant={plant} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function EmptyCollection() {
  return (
    <Card style={styles.emptyPanel}>
      <EmptyPlants size={150} />
      <Text style={styles.emptyTitle}>No plants saved yet</Text>
      <Text style={styles.emptyText}>
        Scan a plant, review its profile, then add it here when it joins your
        collection.
      </Text>
      <Button
        accessibilityLabel="Scan your first plant"
        gradient
        icon="camera"
        label="Scan your first plant"
        onPress={() => router.push("/(auth)/(tabs)/scan")}
      />
    </Card>
  );
}

function PlantCard({ plant }: { plant: SavedPlant }) {
  const status = getStatusDisplay(plant.status);

  return (
    <PressableScale
      accessibilityLabel={`Open ${plant.displayName}`}
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: "/(auth)/plants/[plantId]" as never,
          params: { plantId: plant.id }
        })
      }
      style={styles.card}
    >
      <PlantImage
        accessibilityLabel={`${plant.displayName} photo`}
        iconSize={34}
        style={styles.cardImage}
        uri={plant.photoUrl}
      />
      <View style={styles.cardBody}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {plant.displayName}
        </Text>
        <Text numberOfLines={1} style={styles.speciesName}>
          {plant.species?.commonName ?? "Species unavailable"}
        </Text>
        <View style={styles.cardMeta}>
          <Badge dot label={status.label} tone={status.tone} />
          {plant.location ? (
            <Badge icon="map-marker-outline" label={plant.location} tone="neutral" />
          ) : null}
        </View>
      </View>
      <MaterialCommunityIcons
        color={theme.colors.moss}
        name="chevron-right"
        size={22}
        style={styles.chevron}
      />
    </PressableScale>
  );
}

function getStatusDisplay(status: PlantStatus): { label: string; tone: BadgeTone } {
  switch (status) {
    case "needs_attention":
      return { label: "Needs care", tone: "attention" };
    case "sick":
      return { label: "Sick", tone: "sick" };
    default:
      return { label: "Healthy", tone: "healthy" };
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
  header: {
    marginBottom: theme.spacing.lg
  },
  eyebrow: {
    ...theme.text.eyebrow,
    marginBottom: theme.spacing.xs
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md
  },
  title: {
    ...theme.text.display
  },
  list: {
    gap: theme.spacing.md
  },
  card: {
    alignItems: "stretch",
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 116,
    overflow: "hidden",
    ...theme.shadow.soft
  },
  cardImage: {
    maxWidth: 148,
    minWidth: 104,
    width: "34%"
  },
  cardBody: {
    flex: 1,
    gap: theme.spacing.xs,
    justifyContent: "center",
    padding: theme.spacing.md
  },
  cardTitle: {
    ...theme.text.heading
  },
  speciesName: {
    ...theme.text.caption
  },
  cardMeta: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs
  },
  chevron: {
    alignSelf: "center",
    marginRight: theme.spacing.sm
  },
  emptyPanel: {
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xl
  },
  emptyTitle: {
    ...theme.text.title,
    textAlign: "center"
  },
  emptyText: {
    ...theme.text.body,
    color: theme.colors.moss,
    textAlign: "center"
  }
});
