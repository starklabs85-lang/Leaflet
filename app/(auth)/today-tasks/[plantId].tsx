import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { PremiumLockedScreen } from "@/components/payments/PremiumLockedScreen";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconChip } from "@/components/ui/IconChip";
import { PlantImage } from "@/components/ui/PlantImage";
import { PressableScale } from "@/components/ui/PressableScale";
import { Screen } from "@/components/ui/Screen";
import { theme } from "@/constants/theme";
import { formatCareType, quickLogCare } from "@/lib/api/careSchedule";
import {
  fetchTodayTaskGroupForPlant,
  summarizeTodayTaskGroup,
  type TodayTaskGroup,
  type TodayTaskItem,
  type TodayTaskType
} from "@/lib/api/todayTasks";
import { useEntitlement } from "@/providers/EntitlementProvider";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type LoadState =
  | { status: "loading" }
  | { status: "ready"; group: TodayTaskGroup | null }
  | { status: "error"; message: string };

export default function TodayTaskChecklistScreen() {
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

  return <PremiumTodayTaskChecklistScreen />;
}

function PremiumTodayTaskChecklistScreen() {
  const params = useLocalSearchParams<{ plantId?: string | string[] }>();
  const plantId = Array.isArray(params.plantId) ? params.plantId[0] : params.plantId;
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [optimisticCompleted, setOptimisticCompleted] = useState<
    Record<string, boolean>
  >({});

  const loadGroup = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoadState({ status: "loading" });
    }

    const result = await fetchTodayTaskGroupForPlant(plantId);

    if (!result.ok) {
      setLoadState({ status: "error", message: result.message });
      setRefreshing(false);
      return;
    }

    setLoadState({ status: "ready", group: result.data.group });
    setOptimisticCompleted({});
    setMessage(null);
    setRefreshing(false);
  }, [plantId]);

  useFocusEffect(
    useCallback(() => {
      loadGroup();
    }, [loadGroup])
  );

  const visibleGroup = useMemo(() => {
    if (loadState.status !== "ready" || !loadState.group) {
      return null;
    }

    return applyOptimisticCompletions(loadState.group, optimisticCompleted);
  }, [loadState, optimisticCompleted]);

  async function completeTask(task: TodayTaskItem) {
    if (
      loadState.status !== "ready" ||
      !loadState.group ||
      task.completed ||
      pendingTaskId
    ) {
      return;
    }

    setMessage(null);
    setPendingTaskId(task.id);
    setOptimisticCompleted((current) => ({
      ...current,
      [task.id]: true
    }));

    const result = await quickLogCare({
      userPlantId: loadState.group.plantId,
      type: task.type
    });

    setPendingTaskId(null);

    if (!result.ok) {
      setOptimisticCompleted((current) => omitTask(current, task.id));
      setMessage(
        result.rolledBack ? "No changes were saved. Please try again." : result.message
      );
      return;
    }

    setOptimisticCompleted((current) => omitTask(current, task.id));
    setLoadState((current) => {
      if (current.status !== "ready" || !current.group) {
        return current;
      }

      return {
        status: "ready",
        group: summarizeTodayTaskGroup({
          ...current.group,
          tasks: current.group.tasks.map((existingTask) => {
            if (existingTask.id !== task.id) {
              return existingTask;
            }

            return {
              ...existingTask,
              completed: true,
              completedAt: result.data.log.loggedAt,
              completedLogId: result.data.log.id,
              daysUntilDue:
                result.data.updatedTask?.daysUntilDue ?? existingTask.daysUntilDue,
              nextDueDate:
                result.data.updatedTask?.nextDueDate ?? existingTask.nextDueDate
            };
          })
        })
      };
    });
  }

  if (loadState.status === "loading") {
    return (
      <Screen contentContainerStyle={styles.stateContent}>
        <ActivityIndicator color={theme.colors.forest} size="large" />
        <Text style={styles.stateTitle}>Loading checklist</Text>
        <Text style={styles.stateText}>Getting this plant's tasks for today.</Text>
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
        <Text style={styles.stateTitle}>Checklist unavailable</Text>
        <Text style={styles.stateText}>{loadState.message}</Text>
        <Button
          accessibilityLabel="Retry loading checklist"
          icon="refresh"
          label="Try again"
          onPress={() => loadGroup()}
        />
      </Screen>
    );
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          onRefresh={() => loadGroup(true)}
          refreshing={refreshing}
          tintColor={theme.colors.forest}
        />
      }
    >
      <BackButton />

      {!visibleGroup ? (
        <NoTasksForPlant />
      ) : (
        <>
          <ChecklistHeader group={visibleGroup} />
          {message ? (
            <View style={styles.inlineNotice}>
              <MaterialCommunityIcons
                color={theme.colors.terra}
                name="alert-circle-outline"
                size={18}
              />
              <Text style={styles.inlineNoticeText}>{message}</Text>
            </View>
          ) : null}
          {visibleGroup.isDone ? <DonePanel /> : null}
          <View style={styles.taskList}>
            {visibleGroup.tasks.map((task) => (
              <ChecklistRow
                key={task.id}
                onComplete={() => completeTask(task)}
                pending={pendingTaskId === task.id}
                task={task}
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

function BackButton() {
  return (
    <PressableScale
      accessibilityLabel="Back to Today"
      accessibilityRole="button"
      haptic={false}
      onPress={() => router.replace("/(auth)/(tabs)/tasks" as never)}
      style={styles.backButton}
    >
      <MaterialCommunityIcons
        color={theme.colors.forest}
        name="chevron-left"
        size={24}
      />
      <Text style={styles.backText}>Today</Text>
    </PressableScale>
  );
}

function ChecklistHeader({ group }: { group: TodayTaskGroup }) {
  const plant = group.plant;
  const status = group.isDone
    ? { label: "Done!", tone: "healthy" as BadgeTone }
    : {
        label:
          group.pendingCount === 1
            ? "1 task left"
            : `${group.pendingCount} tasks left`,
        tone: group.overdueCount > 0 ? ("sick" as BadgeTone) : ("attention" as BadgeTone)
      };

  return (
    <Card style={styles.headerCard}>
      <PlantImage
        accessibilityLabel={`${plant?.displayName ?? "Plant"} photo`}
        iconSize={42}
        style={styles.headerImage}
        uri={plant?.photoUrl}
      />
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>Today's Tasks</Text>
        <Text numberOfLines={2} style={styles.title}>
          {plant?.displayName ?? "Plant"}
        </Text>
        <Text numberOfLines={1} style={styles.subtitle}>
          {plant?.species?.commonName ?? "Species unavailable"}
        </Text>
        <Badge
          icon={group.isDone ? "check-circle-outline" : undefined}
          label={status.label}
          style={styles.headerBadge}
          tone={status.tone}
        />
      </View>
    </Card>
  );
}

function DonePanel() {
  return (
    <Card elevated={false} style={styles.donePanel}>
      <View style={styles.donePanelIcon}>
        <MaterialCommunityIcons
          color={theme.colors.white}
          name="check"
          size={20}
        />
      </View>
      <Text style={styles.donePanelText}>Done!</Text>
    </Card>
  );
}

function ChecklistRow({
  onComplete,
  pending,
  task
}: {
  onComplete: () => void;
  pending: boolean;
  task: TodayTaskItem;
}) {
  const due = getDueDisplay(task);
  const completed = task.completed;

  return (
    <PressableScale
      accessibilityLabel={`${completed ? "Completed" : "Complete"} ${formatCareType(
        task.type
      )}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: completed, busy: pending, disabled: completed }}
      disabled={completed || pending}
      onPress={onComplete}
      style={[styles.taskRow, completed ? styles.taskRowDone : null]}
    >
      <View style={[styles.checkbox, completed ? styles.checkboxDone : null]}>
        {pending ? (
          <ActivityIndicator color={theme.colors.forest} size="small" />
        ) : completed ? (
          <MaterialCommunityIcons
            color={theme.colors.white}
            name="check"
            size={18}
          />
        ) : null}
      </View>
      <View style={styles.taskBody}>
        <View style={styles.taskTitleRow}>
          <View style={styles.taskTitleCopy}>
            <View style={styles.taskNameRow}>
              <MaterialCommunityIcons
                color={completed ? theme.colors.moss : theme.colors.leaf}
                name={getCareIcon(task.type)}
                size={18}
              />
              <Text
                style={[
                  styles.taskTitle,
                  completed ? styles.taskTitleDone : null
                ]}
              >
                {formatCareType(task.type)}
              </Text>
            </View>
            <Text
              style={[styles.taskMeta, completed ? styles.taskMetaDone : null]}
            >
              {completed ? "Logged today" : getTaskScheduleText(task)}
            </Text>
          </View>
          <Badge
            label={completed ? "Done!" : due.label}
            tone={completed ? "healthy" : due.tone}
          />
        </View>
      </View>
    </PressableScale>
  );
}

function NoTasksForPlant() {
  return (
    <Card style={styles.emptyPanel}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons
          color={theme.colors.leaf}
          name="check-circle-outline"
          size={54}
        />
      </View>
      <Text style={styles.emptyTitle}>No tasks for this plant</Text>
      <Text style={styles.emptyText}>
        This plant has no due, overdue, or completed care tasks for today.
      </Text>
      <Button
        accessibilityLabel="Back to Today's Tasks"
        icon="calendar-check-outline"
        label="Back to Today"
        onPress={() => router.replace("/(auth)/(tabs)/tasks" as never)}
        variant="secondary"
      />
    </Card>
  );
}

function applyOptimisticCompletions(
  group: TodayTaskGroup,
  optimisticCompleted: Record<string, boolean>
) {
  return summarizeTodayTaskGroup({
    ...group,
    tasks: group.tasks.map((task) =>
      optimisticCompleted[task.id]
        ? {
            ...task,
            completed: true
          }
        : task
    )
  });
}

function omitTask(completed: Record<string, boolean>, taskId: string) {
  const next = { ...completed };
  delete next[taskId];

  return next;
}

function getDueDisplay(task: TodayTaskItem): { label: string; tone: BadgeTone } {
  if (task.daysUntilDue < 0) {
    const days = Math.abs(task.daysUntilDue);

    return {
      label: `Overdue ${days} ${days === 1 ? "day" : "days"}`,
      tone: "sick"
    };
  }

  return { label: "Due today", tone: "healthy" };
}

function getTaskScheduleText(task: TodayTaskItem) {
  if (task.daysUntilDue < 0) {
    const days = Math.abs(task.daysUntilDue);

    return `${days} ${days === 1 ? "day" : "days"} overdue`;
  }

  return `Every ${task.intervalDays} ${task.intervalDays === 1 ? "day" : "days"}`;
}

function getCareIcon(type: TodayTaskType): IconName {
  switch (type) {
    case "water":
      return "water-outline";
    case "fertilize":
      return "leaf";
    case "repot":
      return "sprout";
    case "prune":
      return "content-cut";
    case "rotate":
      return "rotate-3d-variant";
    case "mist":
      return "weather-fog";
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
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    marginBottom: theme.spacing.md,
    minHeight: 44
  },
  backText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.body
  },
  headerCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg
  },
  headerImage: {
    borderRadius: theme.radius.lg,
    height: 96,
    width: 96
  },
  headerCopy: {
    flex: 1
  },
  eyebrow: {
    ...theme.text.eyebrow,
    marginBottom: theme.spacing.xs
  },
  title: {
    ...theme.text.title
  },
  subtitle: {
    ...theme.text.caption,
    marginTop: theme.spacing.xs
  },
  headerBadge: {
    marginTop: theme.spacing.sm
  },
  inlineNotice: {
    alignItems: "center",
    backgroundColor: theme.colors.blush,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md
  },
  inlineNoticeText: {
    color: theme.colors.terra,
    flex: 1,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.caption,
    lineHeight: 18
  },
  donePanel: {
    alignItems: "center",
    backgroundColor: theme.colors.leafMuted,
    borderColor: theme.colors.leaf,
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md
  },
  donePanelIcon: {
    alignItems: "center",
    backgroundColor: theme.colors.leaf,
    borderRadius: theme.radius.pill,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  donePanelText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBlack,
    fontSize: theme.typography.body
  },
  taskList: {
    gap: theme.spacing.md
  },
  taskRow: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.md,
    minHeight: 88,
    padding: theme.spacing.md,
    ...theme.shadow.soft
  },
  taskRowDone: {
    backgroundColor: theme.colors.mist,
    opacity: 0.82
  },
  checkbox: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.leaf,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  checkboxDone: {
    backgroundColor: theme.colors.leaf,
    borderColor: theme.colors.leaf
  },
  taskBody: {
    flex: 1
  },
  taskTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "space-between"
  },
  taskTitleCopy: {
    flex: 1,
    gap: theme.spacing.xs
  },
  taskNameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs
  },
  taskTitle: {
    ...theme.text.bodyStrong
  },
  taskTitleDone: {
    color: theme.colors.moss,
    textDecorationLine: "line-through"
  },
  taskMeta: {
    ...theme.text.caption
  },
  taskMetaDone: {
    color: theme.colors.moss,
    textDecorationLine: "line-through"
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
