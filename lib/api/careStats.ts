import type { CareLog, CareLogType, CareTask, CareTaskType } from "@/types/careSchedule";

const COMPLETABLE_CARE_TYPES = [
  "water",
  "fertilize",
  "repot",
  "prune",
  "rotate",
  "mist"
] as const;
const STREAK_LOOKBACK_DAYS = 180;
const WEEKLY_WINDOW_DAYS = 7;

type CompletableCareType = (typeof COMPLETABLE_CARE_TYPES)[number];

export type CareStats = {
  currentStreak: number;
  weeklyCompletionRate: number;
  weeklyCompleted: number;
  weeklyDue: number;
};

type DateTaskMap = Map<string, Set<string>>;

export function calculateCareStats({
  logs,
  now = new Date(),
  tasks
}: {
  logs: CareLog[];
  now?: Date;
  tasks: CareTask[];
}): CareStats {
  const today = startOfLocalDay(now);
  const todayKey = getLocalDateKey(today);
  const activeTasks = tasks.filter((task) => isCompletableTaskType(task.type) && task.isActive);
  const activeTaskKeys = new Set(activeTasks.map(getTaskKey));
  const completionsByDate = buildCompletionsByDate(logs, activeTaskKeys);
  const dueByDate = buildDueByDate({
    activeTasks,
    completionsByDate,
    todayKey
  });
  const currentStreak = calculateCurrentStreak({
    dueByDate,
    completionsByDate,
    today,
    todayKey
  });
  const weekly = calculateWeeklyCompletion({
    dueByDate,
    completionsByDate,
    today
  });

  return {
    currentStreak,
    weeklyCompletionRate:
      weekly.due === 0 ? 0 : Math.round((weekly.completed / weekly.due) * 100),
    weeklyCompleted: weekly.completed,
    weeklyDue: weekly.due
  };
}

export function isCompletableTaskType(
  type: CareTaskType
): type is CompletableCareType {
  return COMPLETABLE_CARE_TYPES.includes(type as CompletableCareType);
}

export function isCompletableLogType(type: CareLogType): type is CompletableCareType {
  return COMPLETABLE_CARE_TYPES.includes(type as CompletableCareType);
}

function buildCompletionsByDate(logs: CareLog[], activeTaskKeys: Set<string>) {
  return logs.reduce<DateTaskMap>((map, log) => {
    if (!isCompletableLogType(log.type)) {
      return map;
    }

    const taskKey = getTaskKey(log);

    if (!activeTaskKeys.has(taskKey)) {
      return map;
    }

    addToDateTaskMap(map, getLocalDateKey(new Date(log.loggedAt)), taskKey);

    return map;
  }, new Map());
}

function buildDueByDate({
  activeTasks,
  completionsByDate,
  todayKey
}: {
  activeTasks: CareTask[];
  completionsByDate: DateTaskMap;
  todayKey: string;
}) {
  const dueByDate: DateTaskMap = new Map();

  for (const [dateKey, completedTasks] of completionsByDate.entries()) {
    for (const taskKey of completedTasks) {
      addToDateTaskMap(dueByDate, dateKey, taskKey);
    }
  }

  for (const task of activeTasks) {
    if (task.nextDueDate <= todayKey) {
      addToDateTaskMap(dueByDate, task.nextDueDate, getTaskKey(task));
    }
  }

  return dueByDate;
}

function calculateCurrentStreak({
  completionsByDate,
  dueByDate,
  today,
  todayKey
}: {
  completionsByDate: DateTaskMap;
  dueByDate: DateTaskMap;
  today: Date;
  todayKey: string;
}) {
  let streak = 0;

  for (let dayOffset = 0; dayOffset < STREAK_LOOKBACK_DAYS; dayOffset += 1) {
    const dateKey = getLocalDateKey(addDays(today, -dayOffset));
    const dueTasks = dueByDate.get(dateKey);

    if (!dueTasks?.size) {
      continue;
    }

    const completedTasks = completionsByDate.get(dateKey);
    const complete = everyTaskCompleted(dueTasks, completedTasks);

    if (complete) {
      streak += 1;
      continue;
    }

    if (dateKey === todayKey) {
      continue;
    }

    break;
  }

  return streak;
}

function calculateWeeklyCompletion({
  completionsByDate,
  dueByDate,
  today
}: {
  completionsByDate: DateTaskMap;
  dueByDate: DateTaskMap;
  today: Date;
}) {
  let completed = 0;
  let due = 0;

  for (let dayOffset = WEEKLY_WINDOW_DAYS - 1; dayOffset >= 0; dayOffset -= 1) {
    const dateKey = getLocalDateKey(addDays(today, -dayOffset));
    const dueTasks = dueByDate.get(dateKey);

    if (!dueTasks?.size) {
      continue;
    }

    const completedTasks = completionsByDate.get(dateKey);
    due += dueTasks.size;
    completed += countCompletedTasks(dueTasks, completedTasks);
  }

  return { completed, due };
}

function everyTaskCompleted(
  dueTasks: Set<string>,
  completedTasks: Set<string> | undefined
) {
  if (!completedTasks) {
    return false;
  }

  for (const taskKey of dueTasks) {
    if (!completedTasks.has(taskKey)) {
      return false;
    }
  }

  return true;
}

function countCompletedTasks(
  dueTasks: Set<string>,
  completedTasks: Set<string> | undefined
) {
  if (!completedTasks) {
    return 0;
  }

  let completed = 0;

  for (const taskKey of dueTasks) {
    if (completedTasks.has(taskKey)) {
      completed += 1;
    }
  }

  return completed;
}

function getTaskKey(task: Pick<CareLog | CareTask, "type" | "userPlantId">) {
  return `${task.userPlantId}:${task.type}`;
}

function addToDateTaskMap(map: DateTaskMap, dateKey: string, taskKey: string) {
  const tasks = map.get(dateKey) ?? new Set<string>();
  tasks.add(taskKey);
  map.set(dateKey, tasks);
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);

  return next;
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
