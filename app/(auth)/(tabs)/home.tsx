import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import type { User } from "@supabase/supabase-js";

import { Confetti } from "@/components/illustrations/Confetti";
import { EmptyPlants } from "@/components/illustrations/EmptyPlants";
import { LineChart } from "@/components/illustrations/LineChart";
import { ProgressRing } from "@/components/illustrations/ProgressRing";
import { Sparkle } from "@/components/illustrations/Sparkle";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { GradientHeader } from "@/components/ui/GradientHeader";
import { IconChip } from "@/components/ui/IconChip";
import { PlantImage } from "@/components/ui/PlantImage";
import { PressableScale } from "@/components/ui/PressableScale";
import { Screen } from "@/components/ui/Screen";
import { TodayNearYou } from "@/components/weather/TodayNearYou";
import { fetchDashboardData } from "@/lib/api/dashboard";
import { formatCareType, quickLogCare } from "@/lib/api/careSchedule";
import { getGreeting } from "@/lib/greeting";
import {
  ANALYTICS_EVENTS,
  trackAction
} from "@/lib/analytics/firebaseAnalytics";
import {
  getPendingStreakMilestone,
  markStreakMilestoneCelebrated,
  type StreakMilestone
} from "@/lib/careStreakMilestones";
import { theme } from "@/constants/theme";
import { useAuth } from "@/providers/AuthProvider";
import { useEntitlement } from "@/providers/EntitlementProvider";
import type { CareLogType, CareTaskType } from "@/types/careSchedule";
import type { DashboardData, DashboardTask, ConsistencyWeek } from "@/types/dashboard";
import type { PlantStatus, SavedPlant } from "@/types/plantCollection";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: DashboardData; message: string | null }
  | { status: "error"; message: string };

type LoggableTaskType = Extract<CareTaskType, CareLogType>;

const LOGGABLE_TASK_TYPES: LoggableTaskType[] = [
  "water",
  "fertilize",
  "repot",
  "prune",
  "rotate",
  "mist"
];

export default function HomeScreen() {
  const { isPremium } = useEntitlement();

  if (!isPremium) {
    return <FreeDashboard />;
  }

  return <PremiumHomeScreen />;
}

function FreeDashboard() {
  return (
    <Screen contentContainerStyle={styles.freeDashboard}>
      <Text style={styles.freeEyebrow}>Your Fernly dashboard</Text>
      <Text style={styles.freeDashboardTitle}>
        Welcome to Fernly
      </Text>
      <Text style={styles.stateText}>
        Take a clear plant photo, then choose a Premium plan to identify it.
      </Text>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons color={theme.colors.leaf} name="camera-outline" size={40} />
      </View>
      <Button
        gradient
        icon="camera"
        label="Take a plant photo"
        onPress={() => router.push("/(auth)/(tabs)/scan" as never)}
      />
    </Screen>
  );
}

function PremiumHomeScreen() {
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [milestone, setMilestone] = useState<StreakMilestone | null>(null);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoadState({ status: "loading" });
    }

    const result = await fetchDashboardData();

    if (!result.ok) {
      setLoadState({ status: "error", message: result.message });
      setRefreshing(false);
      return;
    }

    setLoadState({ status: "ready", data: result.data, message: null });
    if (auth.user?.id) {
      try {
        const pendingMilestone = await getPendingStreakMilestone({
          currentStreak: result.data.careStats.currentStreak,
          userId: auth.user.id
        });

        if (pendingMilestone) {
          setMilestone(pendingMilestone);
          await markStreakMilestoneCelebrated({
            milestone: pendingMilestone,
            userId: auth.user.id
          });
        }
      } catch {
        // Local celebration state should not block the dashboard.
      }
    }
    setRefreshing(false);
  }, [auth.user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  async function completeTask(task: DashboardTask) {
    if (!isLoggableTaskType(task.type)) {
      openPlant(task.userPlantId);
      return;
    }

    const snapshot = loadState;
    setPendingTaskId(task.id);

    const result = await quickLogCare({
      userPlantId: task.userPlantId,
      type: task.type
    });

    setPendingTaskId(null);

    if (!result.ok) {
      if (snapshot.status === "ready") {
        setLoadState({
          ...snapshot,
          message: result.rolledBack
            ? "No changes were saved. Please try again."
            : result.message
        });
      }
      void trackAction(ANALYTICS_EVENTS.TODAY_TASK_COMPLETE, {
        reason: result.code,
        result: "failure",
        source: "home",
        task_type: task.type
      });
      return;
    }

    void trackAction(ANALYTICS_EVENTS.TODAY_TASK_COMPLETE, {
      result: "success",
      source: "home",
      task_type: task.type
    });
    setLoadState((current) => {
      if (current.status !== "ready") {
        return current;
      }

      return {
        ...current,
        data: {
          ...current.data,
          dueTasks: current.data.dueTasks.filter(
            (existingTask) => existingTask.id !== task.id
          )
        },
        message: null
      };
    });
    loadDashboard(true);
  }

  if (loadState.status === "loading") {
    return (
      <Screen contentContainerStyle={styles.stateContent}>
        <ActivityIndicator color={theme.colors.forest} size="large" />
        <Text style={styles.stateTitle}>Loading your garden</Text>
        <Text style={styles.stateText}>Checking today's plant care.</Text>
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
        <Text style={styles.stateTitle}>Dashboard unavailable</Text>
        <Text style={styles.stateText}>{loadState.message}</Text>
        <Button
          accessibilityLabel="Retry loading dashboard"
          icon="refresh"
          label="Try again"
          onPress={() => loadDashboard()}
        />
      </Screen>
    );
  }

  const data = loadState.data;

  return (
    <Screen
      contentContainerStyle={styles.scrollContent}
      header={
        <GreetingHeader
          plantsNeedingCareCount={data.plantsNeedingCareCount}
          user={auth.user}
        />
      }
      refreshControl={
        <RefreshControl
          onRefresh={() => loadDashboard(true)}
          refreshing={refreshing}
          tintColor={theme.colors.forest}
        />
      }
    >
      {loadState.message ? (
        <View style={styles.inlineNotice}>
          <MaterialCommunityIcons
            color={theme.colors.terra}
            name="alert-circle-outline"
            size={18}
          />
          <Text style={styles.inlineNoticeText}>{loadState.message}</Text>
        </View>
      ) : null}

      <TodayNearYou
        hasPlants={data.totalPlants > 0}
        onCareTaskAdjusted={() => loadDashboard(true)}
      />
      <HealthSummary data={data} />
      <CareMomentumCard data={data} />
      <TodayTasksSection
        onComplete={completeTask}
        pendingTaskId={pendingTaskId}
        tasks={data.dueTasks}
      />
      <PlantsPreview plants={data.plants} />
      <ConsistencyChart
        chartWidth={Math.min(Math.max(width - theme.spacing.xl * 2, 280), 520)}
        weeks={data.consistencyWeeks}
      />

      <MilestoneCelebrationModal
        milestone={milestone}
        onClose={() => setMilestone(null)}
      />
    </Screen>
  );
}

function GreetingHeader({
  plantsNeedingCareCount,
  user
}: {
  plantsNeedingCareCount: number;
  user: User | null;
}) {
  const name = getUserDisplayName(user);
  const greeting = getGreeting();
  const allClear = plantsNeedingCareCount === 0;
  const countText = allClear
    ? "Everyone's happy today"
    : plantsNeedingCareCount === 1
      ? "1 plant needs you today"
      : `${plantsNeedingCareCount} plants need you today`;

  return (
    <GradientHeader>
      <Text style={styles.headerEyebrow}>{formatToday()}</Text>
      <Text style={styles.headerTitle}>
        {greeting}
        {name ? `, ${name}` : ""}
      </Text>
      <View style={styles.headerPill}>
        <MaterialCommunityIcons
          color={theme.colors.white}
          name={allClear ? "white-balance-sunny" : "sprout"}
          size={16}
        />
        <Text style={styles.headerPillText}>{countText}</Text>
      </View>
    </GradientHeader>
  );
}

function HealthSummary({ data }: { data: DashboardData }) {
  const health = Math.round(data.healthPercentage);

  return (
    <Card style={styles.healthCard}>
      <ProgressRing color={theme.colors.canopy} progress={health} size={116}>
        <Text style={styles.ringValue}>{health}%</Text>
        <Text style={styles.ringLabel}>healthy</Text>
      </ProgressRing>
      <View style={styles.statsPanel}>
        <StatRow
          icon="sprout"
          label="Total plants"
          value={String(data.totalPlants)}
          valueColor={theme.colors.forest}
        />
        <View style={styles.statDivider} />
        <StatRow
          icon="calendar-alert"
          label="Overdue tasks"
          value={String(data.overdueTasksCount)}
          valueColor={
            data.overdueTasksCount > 0 ? theme.colors.terra : theme.colors.forest
          }
        />
      </View>
    </Card>
  );
}

function CareMomentumCard({ data }: { data: DashboardData }) {
  const stats = data.careStats;
  const rate = Math.round(Math.max(0, Math.min(100, stats.weeklyCompletionRate)));
  const streakText =
    stats.currentStreak > 0
      ? `${stats.currentStreak}-day care streak`
      : "Start a care streak";
  const weeklyText =
    stats.weeklyDue > 0
      ? `${stats.weeklyCompleted}/${stats.weeklyDue} tasks completed this week`
      : "No care tasks due this week";

  return (
    <Card elevated={false} style={styles.momentumCard}>
      <View style={styles.momentumHeader}>
        <IconChip
          background={theme.colors.white}
          color={theme.colors.ochre}
          icon="fire"
          size={48}
        />
        <View style={styles.momentumCopy}>
          <Text style={styles.momentumTitle}>{streakText}</Text>
          <Text style={styles.momentumSubtitle}>
            {stats.currentStreak > 0
              ? "Keep completing due care to extend it."
              : "Complete today's due tasks to get moving."}
          </Text>
        </View>
      </View>
      <View style={styles.completionRow}>
        <View style={styles.completionMeter}>
          <View style={[styles.completionFill, { width: `${rate}%` }]} />
        </View>
        <Text style={styles.completionRate}>{rate}%</Text>
      </View>
      <Text style={styles.completionText}>{weeklyText}</Text>
    </Card>
  );
}

function MilestoneCelebrationModal({
  milestone,
  onClose
}: {
  milestone: StreakMilestone | null;
  onClose: () => void;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={Boolean(milestone)}
    >
      <View style={styles.milestoneBackdrop}>
        <View style={styles.milestoneCard}>
          <Confetti style={styles.milestoneConfetti} />
          <View style={styles.milestoneIcon}>
            <MaterialCommunityIcons color={theme.colors.white} name="fire" size={34} />
            <View style={styles.milestoneSparkle}>
              <Sparkle size={18} />
            </View>
          </View>
          <Text style={styles.milestoneTitle}>{milestone}-day streak!</Text>
          <Text style={styles.milestoneText}>
            Consistent care is paying off. Keep the rhythm going.
          </Text>
          <Button
            accessibilityLabel="Close streak celebration"
            label="Keep it up"
            onPress={onClose}
          />
        </View>
      </View>
    </Modal>
  );
}

function StatRow({
  icon,
  label,
  value,
  valueColor
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <View style={styles.statRow}>
      <IconChip icon={icon} size={40} />
      <View style={styles.statCopy}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      </View>
    </View>
  );
}

function TodayTasksSection({
  onComplete,
  pendingTaskId,
  tasks
}: {
  onComplete: (task: DashboardTask) => void;
  pendingTaskId: string | null;
  tasks: DashboardTask[];
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Today's tasks</Text>
        {tasks.length > 0 ? (
          <Badge label={String(tasks.length)} tone="attention" />
        ) : null}
      </View>
      {tasks.length === 0 ? (
        <AllCaughtUp />
      ) : (
        <View style={styles.taskList}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              onComplete={() => onComplete(task)}
              pending={pendingTaskId === task.id}
              task={task}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function TaskCard({
  onComplete,
  pending,
  task
}: {
  onComplete: () => void;
  pending: boolean;
  task: DashboardTask;
}) {
  const plant = task.plant;
  const due = getDueDisplay(task);
  const canLog = isLoggableTaskType(task.type);

  return (
    <Card style={styles.taskCard}>
      <PlantImage
        accessibilityLabel={`${plant?.displayName ?? "Plant"} photo`}
        style={styles.taskImage}
        uri={plant?.photoUrl}
      />
      <View style={styles.taskBody}>
        <Text numberOfLines={1} style={styles.taskPlant}>
          {plant?.displayName ?? "Plant"}
        </Text>
        <View style={styles.taskTypeRow}>
          <MaterialCommunityIcons
            color={theme.colors.leaf}
            name={getCareIcon(task.type)}
            size={16}
          />
          <Text style={styles.taskType}>{formatCareType(task.type)}</Text>
        </View>
        <Badge dot label={due.label} tone={due.tone} />
      </View>
      <PressableScale
        accessibilityLabel={`${canLog ? "Mark complete" : "Open"} ${formatCareType(
          task.type
        )} task for ${plant?.displayName ?? "plant"}`}
        accessibilityRole="button"
        accessibilityState={{ busy: pending, disabled: pending }}
        disabled={pending}
        onPress={onComplete}
        style={[styles.doneButton, pending ? styles.disabledButton : null]}
      >
        {pending ? (
          <ActivityIndicator color={theme.colors.white} size="small" />
        ) : (
          <MaterialCommunityIcons
            color={theme.colors.white}
            name={canLog ? "check" : "arrow-right"}
            size={22}
          />
        )}
      </PressableScale>
    </Card>
  );
}

function AllCaughtUp() {
  return (
    <Card style={styles.emptyPanel}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons
          color={theme.colors.leaf}
          name="leaf-circle"
          size={52}
        />
      </View>
      <Text style={styles.emptyTitle}>All caught up</Text>
      <Text style={styles.emptyText}>
        Every plant is happy and watered. Enjoy the calm. 🌿
      </Text>
    </Card>
  );
}

function PlantsPreview({ plants }: { plants: SavedPlant[] }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My plants</Text>
        {plants.length > 0 ? (
          <PressableScale
            accessibilityLabel="Open full plant collection"
            accessibilityRole="button"
            haptic={false}
            onPress={() => router.push("/(auth)/(tabs)/plants")}
            style={styles.linkButton}
          >
            <Text style={styles.linkButtonText}>See all</Text>
            <MaterialCommunityIcons
              color={theme.colors.forest}
              name="chevron-right"
              size={18}
            />
          </PressableScale>
        ) : null}
      </View>

      {plants.length === 0 ? (
        <Card style={styles.emptyCollectionPanel}>
          <EmptyPlants size={132} />
          <Text style={styles.emptyTitle}>Start your collection</Text>
          <Text style={styles.emptyText}>
            Scan your first plant and Fernly will handle the care plan.
          </Text>
          <Button
            accessibilityLabel="Scan a plant to start your collection"
            gradient
            icon="camera"
            label="Scan a plant"
            onPress={() => router.push("/(auth)/(tabs)/scan")}
          />
        </Card>
      ) : (
        <View style={styles.plantsRail}>
          {plants.slice(0, 6).map((plant) => (
            <PlantPreviewCard key={plant.id} plant={plant} />
          ))}
        </View>
      )}
    </View>
  );
}

function PlantPreviewCard({ plant }: { plant: SavedPlant }) {
  const status = getStatusDisplay(plant.status);

  return (
    <PressableScale
      accessibilityLabel={`Open ${plant.displayName}`}
      accessibilityRole="button"
      containerStyle={styles.plantCardWrap}
      onPress={() => openPlant(plant.id)}
      style={styles.plantCard}
    >
      <PlantImage
        accessibilityLabel={`${plant.displayName} photo`}
        iconSize={30}
        style={styles.plantImage}
        uri={plant.photoUrl}
      />
      <View style={styles.plantCardBody}>
        <Text numberOfLines={1} style={styles.plantName}>
          {plant.displayName}
        </Text>
        <Text numberOfLines={1} style={styles.plantSpecies}>
          {plant.species?.commonName ?? "Species unavailable"}
        </Text>
        <Badge dot label={status.label} style={styles.plantBadge} tone={status.tone} />
      </View>
    </PressableScale>
  );
}

function ConsistencyChart({
  chartWidth,
  weeks
}: {
  chartWidth: number;
  weeks: ConsistencyWeek[];
}) {
  const average =
    weeks.length === 0
      ? 0
      : Math.round(
          weeks.reduce((total, week) => total + week.rate, 0) / weeks.length
        );
  const hasExpectedCare = weeks.some((week) => week.expected > 0);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Watering consistency</Text>
        <Badge label={`${average}%`} tone="info" />
      </View>
      <Card style={styles.chartCard} padded={false}>
        <LineChart
          labels={weeks.map((week) => week.label)}
          style={styles.chart}
          values={weeks.map((week) => week.rate)}
          width={chartWidth - 2}
        />
        {!hasExpectedCare ? (
          <Text style={styles.chartNote}>No active watering schedule yet.</Text>
        ) : null}
      </Card>
    </View>
  );
}

function isLoggableTaskType(type: CareTaskType): type is LoggableTaskType {
  return LOGGABLE_TASK_TYPES.includes(type as LoggableTaskType);
}

function openPlant(plantId: string) {
  router.push({
    pathname: "/(auth)/plants/[plantId]" as never,
    params: { plantId }
  });
}

function formatToday() {
  return new Date()
    .toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric"
    })
    .toUpperCase();
}

function getUserDisplayName(user: User | null) {
  const metadata = user?.user_metadata as Record<string, unknown> | undefined;
  const fullName =
    typeof metadata?.full_name === "string"
      ? metadata.full_name
      : typeof metadata?.name === "string"
        ? metadata.name
        : null;

  return fullName?.trim().split(/\s+/)[0] || user?.email?.split("@")[0] || null;
}

function getCareIcon(type: CareTaskType) {
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
    case "check_diagnosis":
      return "clipboard-pulse-outline";
  }
}

function getDueDisplay(task: DashboardTask): { label: string; tone: BadgeTone } {
  if (task.daysUntilDue < 0) {
    const days = Math.abs(task.daysUntilDue);

    return {
      label: `Overdue ${days} ${days === 1 ? "day" : "days"}`,
      tone: "sick"
    };
  }

  return { label: "Due today", tone: "healthy" };
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
  freeDashboard: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center"
  },
  freeDashboardTitle: {
    ...theme.text.display,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.sm,
    textAlign: "center"
  },
  freeEyebrow: {
    ...theme.text.eyebrow,
    color: theme.colors.forest
  },
  scrollContent: {
    paddingTop: theme.spacing.xl
  },
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
  headerEyebrow: {
    color: "rgba(255,255,255,0.78)",
    fontFamily: theme.typography.fontFamily.bodyBlack,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  headerTitle: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontFamily.displayBold,
    fontSize: 32,
    lineHeight: 38,
    marginTop: theme.spacing.sm
  },
  headerPill: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  headerPillText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 13
  },
  inlineNotice: {
    alignItems: "center",
    backgroundColor: theme.colors.blush,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md
  },
  inlineNoticeText: {
    color: theme.colors.terra,
    flex: 1,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.caption,
    lineHeight: 18
  },
  healthCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.lg
  },
  ringValue: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.displayBold,
    fontSize: 26,
    fontVariant: ["tabular-nums"]
  },
  ringLabel: {
    ...theme.text.eyebrow,
    color: theme.colors.moss
  },
  statsPanel: {
    flex: 1,
    gap: theme.spacing.sm
  },
  statDivider: {
    backgroundColor: theme.colors.line,
    height: 1
  },
  statRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md
  },
  statCopy: {
    flex: 1
  },
  statLabel: {
    ...theme.text.caption
  },
  statValue: {
    fontFamily: theme.typography.fontFamily.displayBold,
    fontSize: 20,
    fontVariant: ["tabular-nums"],
    marginTop: 2
  },
  momentumCard: {
    backgroundColor: theme.colors.honey,
    borderColor: "transparent",
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg
  },
  momentumHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md
  },
  momentumCopy: {
    flex: 1
  },
  momentumTitle: {
    ...theme.text.heading
  },
  momentumSubtitle: {
    ...theme.text.caption,
    marginTop: theme.spacing.xs
  },
  completionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md
  },
  completionMeter: {
    backgroundColor: "rgba(28,63,49,0.12)",
    borderRadius: theme.radius.pill,
    flex: 1,
    height: 10,
    overflow: "hidden"
  },
  completionFill: {
    backgroundColor: theme.colors.leaf,
    borderRadius: theme.radius.pill,
    height: "100%"
  },
  completionRate: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.displayBold,
    fontSize: theme.typography.body,
    fontVariant: ["tabular-nums"],
    minWidth: 44,
    textAlign: "right"
  },
  completionText: {
    ...theme.text.caption,
    color: theme.colors.forest
  },
  section: {
    marginTop: theme.spacing.xl
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md
  },
  sectionTitle: {
    ...theme.text.title,
    fontSize: 20
  },
  taskList: {
    gap: theme.spacing.md
  },
  taskCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md
  },
  taskImage: {
    borderRadius: theme.radius.md,
    height: 60,
    width: 60
  },
  taskBody: {
    flex: 1,
    gap: theme.spacing.xs
  },
  taskPlant: {
    ...theme.text.bodyStrong
  },
  taskTypeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs
  },
  taskType: {
    ...theme.text.caption,
    color: theme.colors.leaf
  },
  doneButton: {
    alignItems: "center",
    backgroundColor: theme.colors.forest,
    borderRadius: theme.radius.md,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  disabledButton: {
    opacity: 0.6
  },
  emptyPanel: {
    alignItems: "center",
    paddingVertical: theme.spacing.xl
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: theme.colors.leafMuted,
    borderRadius: theme.radius.pill,
    height: 84,
    justifyContent: "center",
    marginBottom: theme.spacing.md,
    width: 84
  },
  emptyTitle: {
    ...theme.text.heading,
    textAlign: "center"
  },
  emptyText: {
    ...theme.text.body,
    color: theme.colors.moss,
    marginTop: theme.spacing.xs,
    textAlign: "center"
  },
  emptyCollectionPanel: {
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xl
  },
  plantsRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md
  },
  plantCardWrap: {
    flexBasis: "47%",
    flexGrow: 1
  },
  plantCard: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    overflow: "hidden",
    ...theme.shadow.soft
  },
  plantImage: {
    height: 112,
    width: "100%"
  },
  plantCardBody: {
    gap: theme.spacing.xs,
    padding: theme.spacing.md
  },
  plantName: {
    ...theme.text.bodyStrong,
    fontSize: 15
  },
  plantSpecies: {
    ...theme.text.caption
  },
  plantBadge: {
    marginTop: theme.spacing.xs
  },
  chartCard: {
    overflow: "hidden",
    paddingBottom: theme.spacing.md,
    paddingTop: theme.spacing.md
  },
  chart: {
    alignSelf: "center"
  },
  chartNote: {
    ...theme.text.caption,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg
  },
  linkButton: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 36
  },
  linkButtonText: {
    color: theme.colors.forest,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: theme.typography.caption
  },
  milestoneBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(18, 23, 17, 0.55)",
    flex: 1,
    justifyContent: "center",
    padding: theme.spacing.xl
  },
  milestoneCard: {
    alignItems: "center",
    backgroundColor: theme.colors.paper,
    borderRadius: theme.radius.xl,
    gap: theme.spacing.md,
    maxWidth: 360,
    overflow: "hidden",
    padding: theme.spacing.xl,
    width: "100%",
    ...theme.shadow.lifted
  },
  milestoneConfetti: {
    position: "absolute",
    top: 0
  },
  milestoneIcon: {
    alignItems: "center",
    backgroundColor: theme.colors.ochre,
    borderRadius: theme.radius.pill,
    height: 72,
    justifyContent: "center",
    marginTop: theme.spacing.md,
    position: "relative",
    width: 72
  },
  milestoneSparkle: {
    position: "absolute",
    right: -2,
    top: -2
  },
  milestoneTitle: {
    ...theme.text.title,
    textAlign: "center"
  },
  milestoneText: {
    ...theme.text.body,
    color: theme.colors.moss,
    textAlign: "center"
  }
});
