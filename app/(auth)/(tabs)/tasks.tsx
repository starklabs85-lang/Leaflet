import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";

import { PremiumLockedScreen } from "@/components/payments/PremiumLockedScreen";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconChip } from "@/components/ui/IconChip";
import { PlantImage } from "@/components/ui/PlantImage";
import { PressableScale } from "@/components/ui/PressableScale";
import { Screen } from "@/components/ui/Screen";
import { theme } from "@/constants/theme";
import { formatCareType } from "@/lib/api/careSchedule";
import {
  fetchTodayTaskGroups,
  type TodayTaskGroup,
  type TodayTasksData
} from "@/lib/api/todayTasks";
import { useEntitlement } from "@/providers/EntitlementProvider";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: TodayTasksData }
  | { status: "error"; message: string };

export default function TasksScreen() {
  const { isPremium } = useEntitlement();

  if (!isPremium) {
    return (
      <PremiumLockedScreen
        title="Today's tasks require Premium"
        message="Daily care checklists, reminders, and plant schedules are included with Premium. You can still scan one plant per day."
        icon="calendar-check-outline"
      />
    );
  }

  return <PremiumTasksScreen />;
}

function PremiumTasksScreen() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const loadTasks = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoadState({ status: "loading" });
    }

    const result = await fetchTodayTaskGroups();

    if (!result.ok) {
      setLoadState({ status: "error", message: result.message });
      setRefreshing(false);
      return;
    }

    setLoadState({ status: "ready", data: result.data });
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  if (loadState.status === "loading") {
    return (
      <Screen contentContainerStyle={styles.stateContent}>
        <ActivityIndicator color={theme.colors.forest} size="large" />
        <Text style={styles.stateTitle}>Loading today's tasks</Text>
        <Text style={styles.stateText}>Checking due and overdue care.</Text>
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
        <Text style={styles.stateTitle}>Tasks unavailable</Text>
        <Text style={styles.stateText}>{loadState.message}</Text>
        <Button
          accessibilityLabel="Retry loading today's tasks"
          icon="refresh"
          label="Try again"
          onPress={() => loadTasks()}
        />
      </Screen>
    );
  }

  const data = loadState.data;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          onRefresh={() => loadTasks(true)}
          refreshing={refreshing}
          tintColor={theme.colors.forest}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Today</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Today's Tasks</Text>
          {data.groups.length > 0 ? (
            <Badge label={getHeaderBadgeLabel(data)} tone="info" />
          ) : null}
        </View>
      </View>

      {data.groups.length === 0 ? (
        <AllCaughtUp />
      ) : (
        <View style={styles.list}>
          {data.groups.map((group) => (
            <PlantTaskCard group={group} key={group.plantId} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function PlantTaskCard({ group }: { group: TodayTaskGroup }) {
  const plant = group.plant;
  const status = getGroupStatus(group);
  const taskSummary = group.tasks
    .map((task) => formatCareType(task.type))
    .join(", ");

  return (
    <PressableScale
      accessibilityLabel={`Open today's tasks for ${
        plant?.displayName ?? "plant"
      }`}
      accessibilityRole="button"
      onPress={() => openChecklist(group.plantId)}
      style={[styles.cardButton, group.isDone ? styles.doneCard : null]}
    >
      <PlantImage
        accessibilityLabel={`${plant?.displayName ?? "Plant"} photo`}
        iconSize={34}
        style={styles.cardImage}
        uri={plant?.photoUrl}
      />
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <View style={styles.cardTitleText}>
            <Text numberOfLines={1} style={styles.cardTitle}>
              {plant?.displayName ?? "Plant"}
            </Text>
            <Text numberOfLines={1} style={styles.cardSubtitle}>
              {plant?.species?.commonName ?? "Species unavailable"}
            </Text>
          </View>
          {group.isDone ? (
            <View style={styles.doneIcon}>
              <MaterialCommunityIcons
                color={theme.colors.white}
                name="check"
                size={18}
              />
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.taskSummary}>
          {taskSummary}
        </Text>
        <View style={styles.cardMeta}>
          <Badge
            dot={!group.isDone}
            icon={group.isDone ? "check-circle-outline" : undefined}
            label={status.label}
            tone={status.tone}
          />
          {group.overdueCount > 0 ? (
            <Badge
              label={`${group.overdueCount} overdue`}
              tone="sick"
            />
          ) : null}
        </View>
      </View>
      <MaterialCommunityIcons
        color={group.isDone ? theme.colors.leaf : theme.colors.moss}
        name="chevron-right"
        size={22}
        style={styles.chevron}
      />
    </PressableScale>
  );
}

function AllCaughtUp() {
  return (
    <Card style={styles.emptyPanel}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons
          color={theme.colors.leaf}
          name="check-circle-outline"
          size={54}
        />
      </View>
      <Text style={styles.emptyTitle}>All caught up</Text>
      <Text style={styles.emptyText}>
        No due or overdue care tasks are waiting right now.
      </Text>
    </Card>
  );
}

function getHeaderBadgeLabel(data: TodayTasksData) {
  if (data.pendingTaskCount === 0) {
    return "Done!";
  }

  return data.pendingTaskCount === 1
    ? "1 task"
    : `${data.pendingTaskCount} tasks`;
}

function getGroupStatus(group: TodayTaskGroup): {
  label: string;
  tone: BadgeTone;
} {
  if (group.isDone) {
    return { label: "Done!", tone: "healthy" };
  }

  if (group.pendingCount === 1) {
    return { label: "1 task", tone: group.overdueCount > 0 ? "sick" : "attention" };
  }

  return {
    label: `${group.pendingCount} tasks`,
    tone: group.overdueCount > 0 ? "sick" : "attention"
  };
}

function openChecklist(plantId: string) {
  router.push({
    pathname: "/(auth)/today-tasks/[plantId]" as never,
    params: { plantId }
  });
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
    flexWrap: "wrap",
    gap: theme.spacing.md
  },
  title: {
    ...theme.text.display,
    flexShrink: 1
  },
  list: {
    gap: theme.spacing.md
  },
  cardButton: {
    alignItems: "stretch",
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 124,
    overflow: "hidden",
    ...theme.shadow.soft
  },
  doneCard: {
    backgroundColor: theme.colors.mist,
    opacity: 0.82
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
  cardTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  cardTitleText: {
    flex: 1
  },
  cardTitle: {
    ...theme.text.heading
  },
  cardSubtitle: {
    ...theme.text.caption
  },
  doneIcon: {
    alignItems: "center",
    backgroundColor: theme.colors.leaf,
    borderRadius: theme.radius.pill,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  taskSummary: {
    ...theme.text.caption,
    color: theme.colors.forest
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
  emptyIcon: {
    alignItems: "center",
    backgroundColor: theme.colors.leafMuted,
    borderRadius: theme.radius.pill,
    height: 86,
    justifyContent: "center",
    width: 86
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
