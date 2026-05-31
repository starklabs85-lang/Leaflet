import { getLocalDateString, sortCareTasks } from "@/lib/api/careSchedule";
import { calculateCareStats } from "@/lib/api/careStats";
import { listUserPlants } from "@/lib/api/plantCollection";
import { getSupabaseClient } from "@/lib/supabase";
import type { CareLog, CareTask } from "@/types/careSchedule";
import type { DashboardData, DashboardResult, DashboardTask } from "@/types/dashboard";
import type { Database } from "@/types/database";

type CareTaskRow = Database["public"]["Tables"]["care_tasks"]["Row"];
type CareLogRow = Database["public"]["Tables"]["care_logs"]["Row"];

const RECENT_WEEKS = 8;
const STREAK_LOOKBACK_DAYS = 180;

async function getCurrentUser() {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false as const,
      message: "Please sign in again to load your dashboard."
    };
  }

  return { ok: true as const, user };
}

function parseLocalDate(value: string) {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  return new Date(year, month - 1, day);
}

function daysBetweenLocalDates(fromDateString: string, toDateString: string) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const from = parseLocalDate(fromDateString).getTime();
  const to = parseLocalDate(toDateString).getTime();

  return Math.round((to - from) / millisecondsPerDay);
}

function toCareTask(row: CareTaskRow): CareTask {
  const daysUntilDue = daysBetweenLocalDates(getLocalDateString(), row.next_due_date);

  return {
    id: row.id,
    userPlantId: row.user_plant_id,
    userId: row.user_id,
    type: row.type,
    intervalDays: row.interval_days,
    nextDueDate: row.next_due_date,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dueState:
      daysUntilDue <= 0
        ? "overdue"
        : daysUntilDue === 1
          ? "due_tomorrow"
          : "upcoming",
    daysUntilDue
  };
}

function toCareLog(row: CareLogRow): CareLog {
  return {
    id: row.id,
    userPlantId: row.user_plant_id,
    userId: row.user_id,
    type: row.task_type,
    note: row.note,
    photoUrl: row.photo_url,
    loggedAt: row.logged_at,
    createdAt: row.created_at
  };
}

async function fetchActiveCareTasks(userId: string) {
  const { data, error } = await getSupabaseClient()
    .from("care_tasks")
    .select(
      "id, user_plant_id, user_id, type, interval_days, next_due_date, is_active, created_at, updated_at"
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("next_due_date", { ascending: true })
    .returns<CareTaskRow[]>();

  if (error) {
    return {
      ok: false as const,
      message: "Care tasks could not be loaded."
    };
  }

  return {
    ok: true as const,
    data: sortCareTasks((data ?? []).map(toCareTask))
  };
}

async function fetchRecentCareLogs(userId: string, startDate: Date) {
  const { data, error } = await getSupabaseClient()
    .from("care_logs")
    .select(
      "id, user_plant_id, user_id, task_type, note, photo_url, logged_at, created_at"
    )
    .eq("user_id", userId)
    .gte("logged_at", startDate.toISOString())
    .order("logged_at", { ascending: false })
    .returns<CareLogRow[]>();

  if (error) {
    return {
      ok: false as const,
      message: "Care history could not be loaded."
    };
  }

  return {
    ok: true as const,
    data: (data ?? []).map(toCareLog)
  };
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);

  return next;
}

function formatWeekLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function buildConsistencyWeeks(activeTasks: DashboardTask[], recentLogs: CareLog[]) {
  const today = startOfLocalDay(new Date());
  const waterTasks = activeTasks.filter((task) => task.type === "water");
  const expectedPerWeek = waterTasks.reduce((total, task) => {
    const intervalDays = Math.max(1, task.intervalDays);

    return total + Math.max(1, Math.ceil(7 / intervalDays));
  }, 0);

  return Array.from({ length: RECENT_WEEKS }, (_, index) => {
    const start = addDays(today, -(RECENT_WEEKS - index) * 7 + 1);
    const end = addDays(start, 6);
    const completed = recentLogs.filter((log) => {
      if (log.type !== "water") {
        return false;
      }

      const loggedAt = new Date(log.loggedAt);

      return loggedAt >= start && loggedAt <= addDays(end, 1);
    }).length;

    return {
      key: `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`,
      label: formatWeekLabel(start),
      completed,
      expected: expectedPerWeek,
      rate:
        expectedPerWeek === 0
          ? 0
          : Math.min(100, Math.round((completed / expectedPerWeek) * 100))
    };
  });
}

export async function fetchDashboardData(): Promise<DashboardResult<DashboardData>> {
  const userResult = await getCurrentUser();

  if (!userResult.ok) {
    return {
      ok: false,
      code: "auth_required",
      message: userResult.message
    };
  }

  const recentStartDate = addDays(
    startOfLocalDay(new Date()),
    -Math.max(RECENT_WEEKS * 7, STREAK_LOOKBACK_DAYS)
  );
  const [plantsResult, tasksResult, logsResult] = await Promise.all([
    listUserPlants(),
    fetchActiveCareTasks(userResult.user.id),
    fetchRecentCareLogs(userResult.user.id, recentStartDate)
  ]);

  if (!plantsResult.ok) {
    return {
      ok: false,
      code: plantsResult.code === "auth_required" ? "auth_required" : "network_error",
      message: plantsResult.message
    };
  }

  if (!tasksResult.ok) {
    return {
      ok: false,
      code: "network_error",
      message: tasksResult.message
    };
  }

  if (!logsResult.ok) {
    return {
      ok: false,
      code: "network_error",
      message: logsResult.message
    };
  }

  const today = getLocalDateString();
  const plantsById = new Map(plantsResult.data.map((plant) => [plant.id, plant]));
  const activeTasks = tasksResult.data.map<DashboardTask>((task) => ({
    ...task,
    plant: plantsById.get(task.userPlantId) ?? null
  }));
  const dueTasks = activeTasks.filter((task) => task.nextDueDate <= today);
  const healthyCount = plantsResult.data.filter(
    (plant) => plant.status === "healthy"
  ).length;
  const needingCare = new Set(dueTasks.map((task) => task.userPlantId));

  return {
    ok: true,
    data: {
      plants: plantsResult.data,
      dueTasks,
      activeTasks,
      recentLogs: logsResult.data,
      careStats: calculateCareStats({
        tasks: activeTasks,
        logs: logsResult.data
      }),
      consistencyWeeks: buildConsistencyWeeks(activeTasks, logsResult.data),
      healthPercentage:
        plantsResult.data.length === 0
          ? 0
          : Math.round((healthyCount / plantsResult.data.length) * 100),
      totalPlants: plantsResult.data.length,
      overdueTasksCount: dueTasks.filter((task) => task.nextDueDate < today).length,
      plantsNeedingCareCount: needingCare.size
    }
  };
}
