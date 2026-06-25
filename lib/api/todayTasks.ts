import { fetchDashboardData } from "@/lib/api/dashboard";
import { getLocalDateString } from "@/lib/api/careSchedule";
import type { CareLog, CareLogType, CareTaskType } from "@/types/careSchedule";
import type { DashboardData, DashboardTask } from "@/types/dashboard";
import type { SavedPlant } from "@/types/plantCollection";

export type TodayTaskType = Extract<CareTaskType, CareLogType>;

export type TodayTaskItem = {
  id: string;
  userPlantId: string;
  userId: string;
  type: TodayTaskType;
  intervalDays: number;
  nextDueDate: string;
  daysUntilDue: number;
  completed: boolean;
  completedAt: string | null;
  completedLogId: string | null;
};

export type TodayTaskGroup = {
  plantId: string;
  plant: SavedPlant | null;
  tasks: TodayTaskItem[];
  pendingCount: number;
  completedCount: number;
  overdueCount: number;
  isDone: boolean;
};

export type TodayTasksData = {
  today: string;
  groups: TodayTaskGroup[];
  pendingTaskCount: number;
  completedTaskCount: number;
  pendingPlantCount: number;
  donePlantCount: number;
};

export type TodayTaskPlantData = TodayTasksData & {
  group: TodayTaskGroup | null;
};

type TodayTasksErrorCode = "auth_required" | "network_error" | "invalid_input";

export type TodayTasksResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      code: TodayTasksErrorCode;
      message: string;
    };

const TODAY_TASK_TYPES: TodayTaskType[] = [
  "water",
  "fertilize",
  "repot",
  "prune",
  "rotate",
  "mist"
];

export function isTodayTaskType(type: CareTaskType): type is TodayTaskType {
  return TODAY_TASK_TYPES.includes(type as TodayTaskType);
}

export async function fetchTodayTaskGroups(): Promise<
  TodayTasksResult<TodayTasksData>
> {
  const dashboard = await fetchDashboardData();

  if (!dashboard.ok) {
    return {
      ok: false,
      code: dashboard.code,
      message: dashboard.message
    };
  }

  return {
    ok: true,
    data: buildTodayTaskGroups(dashboard.data)
  };
}

export async function fetchTodayTaskGroupForPlant(
  plantId: string | undefined
): Promise<TodayTasksResult<TodayTaskPlantData>> {
  const normalizedPlantId = plantId?.trim();

  if (!normalizedPlantId) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Plant tasks are unavailable."
    };
  }

  const groupsResult = await fetchTodayTaskGroups();

  if (!groupsResult.ok) {
    return groupsResult;
  }

  return {
    ok: true,
    data: {
      ...groupsResult.data,
      group:
        groupsResult.data.groups.find(
          (group) => group.plantId === normalizedPlantId
        ) ?? null
    }
  };
}

export function buildTodayTaskGroups(
  data: DashboardData,
  today = getLocalDateString()
): TodayTasksData {
  const plantsById = new Map(data.plants.map((plant) => [plant.id, plant]));
  const todayLogsByPlantAndType = buildTodayLogMap(data.recentLogs, today);
  const itemsByTaskId = new Map<string, TodayTaskItem>();

  for (const task of data.activeTasks) {
    if (!task.isActive || !isTodayTaskType(task.type)) {
      continue;
    }

    const completedLog =
      todayLogsByPlantAndType.get(taskLogKey(task.userPlantId, task.type)) ?? null;
    const isDueTodayOrOverdue = task.nextDueDate <= today;

    if (!isDueTodayOrOverdue && !completedLog) {
      continue;
    }

    itemsByTaskId.set(task.id, toTodayTaskItem(task, completedLog));
  }

  const groupMap = new Map<string, TodayTaskGroup>();

  for (const item of itemsByTaskId.values()) {
    const existing = groupMap.get(item.userPlantId);
    const taskPlant =
      data.activeTasks.find((task) => task.id === item.id)?.plant ??
      plantsById.get(item.userPlantId) ??
      null;

    if (existing) {
      existing.tasks.push(item);
      continue;
    }

    groupMap.set(item.userPlantId, {
      plantId: item.userPlantId,
      plant: taskPlant,
      tasks: [item],
      pendingCount: 0,
      completedCount: 0,
      overdueCount: 0,
      isDone: false
    });
  }

  const groups = [...groupMap.values()]
    .map(summarizeGroup)
    .sort(compareGroups);

  return {
    today,
    groups,
    pendingTaskCount: groups.reduce((total, group) => total + group.pendingCount, 0),
    completedTaskCount: groups.reduce(
      (total, group) => total + group.completedCount,
      0
    ),
    pendingPlantCount: groups.filter((group) => !group.isDone).length,
    donePlantCount: groups.filter((group) => group.isDone).length
  };
}

export function summarizeTodayTaskGroup(group: TodayTaskGroup): TodayTaskGroup {
  return summarizeGroup(group);
}

function buildTodayLogMap(logs: CareLog[], today: string) {
  return logs.reduce<Map<string, CareLog>>((map, log) => {
    if (!isTodayTaskLogType(log.type)) {
      return map;
    }

    if (getLocalDateString(new Date(log.loggedAt)) !== today) {
      return map;
    }

    const key = taskLogKey(log.userPlantId, log.type);
    const existing = map.get(key);

    if (!existing || log.loggedAt > existing.loggedAt) {
      map.set(key, log);
    }

    return map;
  }, new Map<string, CareLog>());
}

function isTodayTaskLogType(type: CareLogType): type is TodayTaskType {
  return TODAY_TASK_TYPES.includes(type as TodayTaskType);
}

function taskLogKey(plantId: string, type: TodayTaskType) {
  return `${plantId}:${type}`;
}

function toTodayTaskItem(
  task: DashboardTask,
  completedLog: CareLog | null
): TodayTaskItem {
  return {
    id: task.id,
    userPlantId: task.userPlantId,
    userId: task.userId,
    type: task.type as TodayTaskType,
    intervalDays: task.intervalDays,
    nextDueDate: task.nextDueDate,
    daysUntilDue: task.daysUntilDue,
    completed: Boolean(completedLog),
    completedAt: completedLog?.loggedAt ?? null,
    completedLogId: completedLog?.id ?? null
  };
}

function summarizeGroup(group: TodayTaskGroup): TodayTaskGroup {
  const tasks = [...group.tasks].sort(compareTasks);
  const pendingCount = tasks.filter((task) => !task.completed).length;
  const completedCount = tasks.length - pendingCount;

  return {
    ...group,
    tasks,
    pendingCount,
    completedCount,
    overdueCount: tasks.filter(
      (task) => !task.completed && task.daysUntilDue < 0
    ).length,
    isDone: tasks.length > 0 && pendingCount === 0
  };
}

function compareTasks(left: TodayTaskItem, right: TodayTaskItem) {
  if (left.completed !== right.completed) {
    return left.completed ? 1 : -1;
  }

  const dateComparison = left.nextDueDate.localeCompare(right.nextDueDate);

  return dateComparison === 0
    ? left.type.localeCompare(right.type)
    : dateComparison;
}

function compareGroups(left: TodayTaskGroup, right: TodayTaskGroup) {
  if (left.isDone !== right.isDone) {
    return left.isDone ? 1 : -1;
  }

  const leftDueDate = left.tasks[0]?.nextDueDate ?? "";
  const rightDueDate = right.tasks[0]?.nextDueDate ?? "";
  const dueComparison = leftDueDate.localeCompare(rightDueDate);

  if (dueComparison !== 0) {
    return dueComparison;
  }

  return getPlantDisplayName(left).localeCompare(getPlantDisplayName(right));
}

function getPlantDisplayName(group: TodayTaskGroup) {
  return group.plant?.displayName ?? "Plant";
}
