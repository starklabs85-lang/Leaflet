import { getSupabaseClient } from "@/lib/supabase";
import {
  syncCareTaskReminder,
  syncCareTasksForPlant
} from "@/lib/notifications/careReminders";
import type { Database, Json } from "@/types/database";
import type {
  CareLog,
  CareLogType,
  CareResult,
  CareTask,
  CareTaskType,
  EnsureCareTasksResult,
  GeneratedCareTask,
  QuickLogResult
} from "@/types/careSchedule";

type CareTaskRow = Database["public"]["Tables"]["care_tasks"]["Row"];
type CareLogRow = Database["public"]["Tables"]["care_logs"]["Row"];
type QuickLogCareTaskType = Extract<CareTaskType, CareLogType>;

const CARE_TASK_TYPES: QuickLogCareTaskType[] = [
  "water",
  "fertilize",
  "repot",
  "prune",
  "rotate",
  "mist"
];

const QUICK_LOG_TYPES: CareLogType[] = [
  "water",
  "fertilize",
  "repot",
  "prune",
  "rotate",
  "mist",
  "note"
];

const MAX_EDITABLE_INTERVAL_DAYS = 365;

async function getCurrentUser() {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false as const,
      message: "Please sign in again to manage care."
    };
  }

  return { ok: true as const, user };
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function normalizeId(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function isRecord(value: Json | undefined): value is { [key: string]: Json | undefined } {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function jsonToSearchText(value: Json | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(jsonToSearchText).filter(Boolean).join(" ");
  }

  return Object.values(value).map(jsonToSearchText).filter(Boolean).join(" ");
}

function careProfileText(careProfile: Json, keys: string[]) {
  if (!isRecord(careProfile)) {
    return "";
  }

  const exactText = keys
    .map((key) => jsonToSearchText(careProfile[key]))
    .filter(Boolean)
    .join(" ");

  if (exactText) {
    return exactText;
  }

  const lowerKeys = keys.map((key) => key.toLowerCase());
  const fuzzyValues = Object.entries(careProfile)
    .filter(([key]) =>
      lowerKeys.some((candidate) => key.toLowerCase().includes(candidate))
    )
    .map(([, value]) => jsonToSearchText(value))
    .filter(Boolean);

  return fuzzyValues.join(" ");
}

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string) {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  return new Date(year, month - 1, day);
}

export function addDaysToLocalDate(days: number, fromDate = new Date()) {
  const nextDate = new Date(
    fromDate.getFullYear(),
    fromDate.getMonth(),
    fromDate.getDate()
  );
  nextDate.setDate(nextDate.getDate() + days);

  return getLocalDateString(nextDate);
}

function daysBetweenLocalDates(fromDateString: string, toDateString: string) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const from = parseLocalDate(fromDateString).getTime();
  const to = parseLocalDate(toDateString).getTime();

  return Math.round((to - from) / millisecondsPerDay);
}

function dueStateFor(nextDueDate: string) {
  const daysUntilDue = daysBetweenLocalDates(getLocalDateString(), nextDueDate);

  return {
    daysUntilDue,
    dueState:
      daysUntilDue <= 0
        ? ("overdue" as const)
        : daysUntilDue === 1
          ? ("due_tomorrow" as const)
          : ("upcoming" as const)
  };
}

function toCareTask(row: CareTaskRow): CareTask {
  const due = dueStateFor(row.next_due_date);

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
    dueState: due.dueState,
    daysUntilDue: due.daysUntilDue
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

export function sortCareTasks(tasks: CareTask[]) {
  return [...tasks].sort((left, right) => {
    const dateComparison = left.nextDueDate.localeCompare(right.nextDueDate);

    return dateComparison === 0 ? left.type.localeCompare(right.type) : dateComparison;
  });
}

function safeInterval(value: number, fallback: number) {
  if (!Number.isFinite(value) || value < 1) {
    return fallback;
  }

  return Math.min(Math.round(value), MAX_EDITABLE_INTERVAL_DAYS);
}

export function parseIntervalDays(text: string, fallback: number) {
  const normalized = text.toLowerCase();

  if (/\b(daily|every day|each day)\b/.test(normalized)) {
    return 1;
  }

  if (/\b(bi[-\s]?weekly|every\s+(two|2)\s+weeks?)\b/.test(normalized)) {
    return 14;
  }

  const everyDaysMatch = normalized.match(
    /\bevery\s+(\d+)\s*(?:-|to)?\s*(\d+)?\s*days?\b/
  );

  if (everyDaysMatch) {
    return safeInterval(
      Number(everyDaysMatch[2] ?? everyDaysMatch[1]),
      fallback
    );
  }

  const rangeDaysMatch = normalized.match(/\b(\d+)\s*(?:-|to)\s*(\d+)\s*days?\b/);

  if (rangeDaysMatch) {
    return safeInterval(Number(rangeDaysMatch[2]), fallback);
  }

  const weeksMatch = normalized.match(/\bevery\s+(\d+)\s+weeks?\b/);

  if (weeksMatch) {
    return safeInterval(Number(weeksMatch[1]) * 7, fallback);
  }

  if (/\b(weekly|once a week|every week)\b/.test(normalized)) {
    return 7;
  }

  if (/\b(monthly|once a month|every month)\b/.test(normalized)) {
    return 30;
  }

  const daysMatch = normalized.match(/\b(\d+)\s*days?\b/);

  if (daysMatch) {
    return safeInterval(Number(daysMatch[1]), fallback);
  }

  return fallback;
}

function hasHighHumidityNeed(text: string) {
  const normalized = text.toLowerCase();

  if (!normalized) {
    return false;
  }

  if (/\b(low humidity|dry air|avoid mist|do not mist|no mist)\b/.test(normalized)) {
    return false;
  }

  const percentages = [...normalized.matchAll(/(\d{2,3})\s*%/g)].map((match) =>
    Number(match[1])
  );

  if (percentages.some((percentage) => percentage >= 60)) {
    return true;
  }

  return /\b(high humidity|humid|misting|mist regularly|tropical|moist air)\b/.test(
    normalized
  );
}

export function buildDefaultCareTasks(
  careProfile: Json,
  fromDate = new Date()
): GeneratedCareTask[] {
  const waterText = careProfileText(careProfile, ["water", "watering"]);
  const feedingText = careProfileText(careProfile, [
    "feeding",
    "fertilize",
    "fertilizer",
    "feed"
  ]);
  const humidityText = careProfileText(careProfile, ["humidity", "mist", "misting"]);

  const tasks: GeneratedCareTask[] = [
    {
      type: "water",
      intervalDays: parseIntervalDays(waterText, 7),
      nextDueDate: addDaysToLocalDate(parseIntervalDays(waterText, 7), fromDate)
    },
    {
      type: "fertilize",
      intervalDays: parseIntervalDays(feedingText, 30),
      nextDueDate: addDaysToLocalDate(parseIntervalDays(feedingText, 30), fromDate)
    },
    {
      type: "rotate",
      intervalDays: 14,
      nextDueDate: addDaysToLocalDate(14, fromDate)
    }
  ];

  if (hasHighHumidityNeed(humidityText)) {
    const mistInterval = parseIntervalDays(humidityText, 3);
    tasks.push({
      type: "mist",
      intervalDays: mistInterval,
      nextDueDate: addDaysToLocalDate(mistInterval, fromDate)
    });
  }

  return tasks;
}

export async function generateDefaultCareTasksForPlant({
  speciesId,
  userId,
  userPlantId
}: {
  speciesId: string | null;
  userId: string;
  userPlantId: string;
}): Promise<CareResult<EnsureCareTasksResult>> {
  const existing = await listCareTasksForPlant(userPlantId);

  if (!existing.ok) {
    return existing;
  }

  if (existing.data.length > 0) {
    return {
      ok: true,
      data: {
        created: false,
        tasks: existing.data
      }
    };
  }

  let careProfile: Json = {};

  if (speciesId) {
    const { data, error } = await getSupabaseClient()
      .from("species")
      .select("care_profile")
      .eq("id", speciesId)
      .maybeSingle()
      .returns<{ care_profile: Json } | null>();

    if (error) {
      return {
        ok: false,
        code: "network_error",
        message: "Care profile could not be loaded."
      };
    }

    careProfile = data?.care_profile ?? {};
  }

  const taskRows = buildDefaultCareTasks(careProfile).map((task) => ({
    user_plant_id: userPlantId,
    user_id: userId,
    type: task.type,
    interval_days: task.intervalDays,
    next_due_date: task.nextDueDate,
    is_active: true
  }));

  const { data, error } = await getSupabaseClient()
    .from("care_tasks")
    .insert(taskRows)
    .select(
      "id, user_plant_id, user_id, type, interval_days, next_due_date, is_active, created_at, updated_at"
    )
    .returns<CareTaskRow[]>();

  if (error) {
    return {
      ok: false,
      code: "network_error",
      message: "Care schedule could not be created."
    };
  }

  const tasks = sortCareTasks((data ?? []).map(toCareTask));
  await syncPlantRemindersSafely(userPlantId);

  return {
    ok: true,
    data: {
      created: true,
      tasks
    }
  };
}

export async function ensureCareTasksForPlant(
  userPlantId: string | undefined
): Promise<CareResult<EnsureCareTasksResult>> {
  const normalizedPlantId = normalizeId(userPlantId);

  if (!normalizedPlantId) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Care schedule is unavailable for this plant."
    };
  }

  const userResult = await getCurrentUser();

  if (!userResult.ok) {
    return {
      ok: false,
      code: "auth_required",
      message: userResult.message
    };
  }

  const { data, error } = await getSupabaseClient()
    .from("user_plants")
    .select("id, user_id, species_id")
    .eq("id", normalizedPlantId)
    .eq("user_id", userResult.user.id)
    .maybeSingle()
    .returns<{ id: string; user_id: string; species_id: string | null } | null>();

  if (error) {
    return {
      ok: false,
      code: "network_error",
      message: "Plant care details could not be loaded."
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "not_found",
      message: "Plant not found."
    };
  }

  return generateDefaultCareTasksForPlant({
    userPlantId: data.id,
    userId: data.user_id,
    speciesId: data.species_id
  });
}

export async function listCareTasksForPlant(
  userPlantId: string | undefined
): Promise<CareResult<CareTask[]>> {
  const normalizedPlantId = normalizeId(userPlantId);

  if (!normalizedPlantId) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Care schedule is unavailable for this plant."
    };
  }

  const userResult = await getCurrentUser();

  if (!userResult.ok) {
    return {
      ok: false,
      code: "auth_required",
      message: userResult.message
    };
  }

  const { data, error } = await getSupabaseClient()
    .from("care_tasks")
    .select(
      "id, user_plant_id, user_id, type, interval_days, next_due_date, is_active, created_at, updated_at"
    )
    .eq("user_plant_id", normalizedPlantId)
    .eq("user_id", userResult.user.id)
    .order("next_due_date", { ascending: true })
    .returns<CareTaskRow[]>();

  if (error) {
    return {
      ok: false,
      code: "network_error",
      message: "Care schedule could not be loaded."
    };
  }

  return {
    ok: true,
    data: sortCareTasks((data ?? []).map(toCareTask))
  };
}

export async function listCareLogsForPlant(
  userPlantId: string | undefined,
  limit = 40
): Promise<CareResult<CareLog[]>> {
  const normalizedPlantId = normalizeId(userPlantId);

  if (!normalizedPlantId) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Care history is unavailable for this plant."
    };
  }

  const userResult = await getCurrentUser();

  if (!userResult.ok) {
    return {
      ok: false,
      code: "auth_required",
      message: userResult.message
    };
  }

  const { data, error } = await getSupabaseClient()
    .from("care_logs")
    .select(
      "id, user_plant_id, user_id, task_type, note, photo_url, logged_at, created_at"
    )
    .eq("user_plant_id", normalizedPlantId)
    .eq("user_id", userResult.user.id)
    .neq("task_type", "growth_photo")
    .order("logged_at", { ascending: false })
    .limit(limit)
    .returns<CareLogRow[]>();

  if (error) {
    return {
      ok: false,
      code: "network_error",
      message: "Care history could not be loaded."
    };
  }

  return {
    ok: true,
    data: (data ?? []).map(toCareLog)
  };
}

function isCareLogType(value: CareLogType): value is CareLogType {
  return QUICK_LOG_TYPES.includes(value);
}

function isCareTaskType(value: CareLogType): value is QuickLogCareTaskType {
  return CARE_TASK_TYPES.includes(value as QuickLogCareTaskType);
}

export function applyOptimisticQuickLog(tasks: CareTask[], type: CareLogType) {
  if (!isCareTaskType(type)) {
    return tasks;
  }

  return sortCareTasks(
    tasks.map((task) => {
      if (task.type !== type || !task.isActive) {
        return task;
      }

      const nextDueDate = addDaysToLocalDate(task.intervalDays);
      const due = dueStateFor(nextDueDate);

      return {
        ...task,
        nextDueDate,
        dueState: due.dueState,
        daysUntilDue: due.daysUntilDue
      };
    })
  );
}

export async function quickLogCare({
  note,
  type,
  userPlantId
}: {
  note?: string | null;
  type: CareLogType;
  userPlantId: string | undefined;
}): Promise<CareResult<QuickLogResult>> {
  const normalizedPlantId = normalizeId(userPlantId);

  if (!normalizedPlantId || !isCareLogType(type)) {
    return {
      ok: false,
      code: "invalid_input",
      message: "This care action could not be logged."
    };
  }

  const normalizedNote = normalizeOptionalText(note);

  if (type === "note" && !normalizedNote) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Add a note before saving it."
    };
  }

  const userResult = await getCurrentUser();

  if (!userResult.ok) {
    return {
      ok: false,
      code: "auth_required",
      message: userResult.message
    };
  }

  const supabase = getSupabaseClient();
  const { data: logRow, error: logError } = await supabase
    .from("care_logs")
    .insert({
      user_plant_id: normalizedPlantId,
      user_id: userResult.user.id,
      task_type: type,
      note: normalizedNote
    })
    .select(
      "id, user_plant_id, user_id, task_type, note, photo_url, logged_at, created_at"
    )
    .single()
    .returns<CareLogRow>();

  if (logError) {
    return {
      ok: false,
      code: "network_error",
      message: "Care action could not be saved."
    };
  }

  if (!isCareTaskType(type)) {
    return {
      ok: true,
      data: {
        log: toCareLog(logRow),
        updatedTask: null
      }
    };
  }

  const { data: taskRow, error: taskError } = await supabase
    .from("care_tasks")
    .select(
      "id, user_plant_id, user_id, type, interval_days, next_due_date, is_active, created_at, updated_at"
    )
    .eq("user_plant_id", normalizedPlantId)
    .eq("user_id", userResult.user.id)
    .eq("type", type)
    .eq("is_active", true)
    .maybeSingle()
    .returns<CareTaskRow | null>();

  if (taskError) {
    await rollbackCareLog(logRow.id, userResult.user.id);

    return {
      ok: false,
      code: "network_error",
      message: "Care action could not be finished.",
      rolledBack: true
    };
  }

  if (!taskRow) {
    return {
      ok: true,
      data: {
        log: toCareLog(logRow),
        updatedTask: null
      }
    };
  }

  const { data: updatedTaskRow, error: updateError } = await supabase
    .from("care_tasks")
    .update({
      next_due_date: addDaysToLocalDate(taskRow.interval_days)
    })
    .eq("id", taskRow.id)
    .eq("user_id", userResult.user.id)
    .select(
      "id, user_plant_id, user_id, type, interval_days, next_due_date, is_active, created_at, updated_at"
    )
    .maybeSingle()
    .returns<CareTaskRow | null>();

  if (updateError || !updatedTaskRow) {
    await rollbackCareLog(logRow.id, userResult.user.id);

    return {
      ok: false,
      code: "network_error",
      message: "Care action could not be finished.",
      rolledBack: true
    };
  }

  await syncTaskReminderSafely(updatedTaskRow.id);

  return {
    ok: true,
    data: {
      log: toCareLog(logRow),
      updatedTask: toCareTask(updatedTaskRow)
    }
  };
}

async function rollbackCareLog(logId: string, userId: string) {
  await getSupabaseClient()
    .from("care_logs")
    .delete()
    .eq("id", logId)
    .eq("user_id", userId);
}

export async function updateCareTask({
  intervalDays,
  isActive,
  taskId,
  userPlantId
}: {
  intervalDays: number;
  isActive: boolean;
  taskId: string;
  userPlantId: string;
}): Promise<CareResult<CareTask>> {
  const normalizedTaskId = normalizeId(taskId);
  const normalizedPlantId = normalizeId(userPlantId);
  const roundedInterval = Math.round(intervalDays);

  if (
    !normalizedTaskId ||
    !normalizedPlantId ||
    !Number.isFinite(roundedInterval) ||
    roundedInterval < 1 ||
    roundedInterval > MAX_EDITABLE_INTERVAL_DAYS
  ) {
    return {
      ok: false,
      code: "invalid_input",
      message: `Choose a care interval between 1 and ${MAX_EDITABLE_INTERVAL_DAYS} days.`
    };
  }

  const userResult = await getCurrentUser();

  if (!userResult.ok) {
    return {
      ok: false,
      code: "auth_required",
      message: userResult.message
    };
  }

  const { data, error } = await getSupabaseClient()
    .from("care_tasks")
    .update({
      interval_days: roundedInterval,
      is_active: isActive,
      next_due_date: addDaysToLocalDate(roundedInterval)
    })
    .eq("id", normalizedTaskId)
    .eq("user_plant_id", normalizedPlantId)
    .eq("user_id", userResult.user.id)
    .select(
      "id, user_plant_id, user_id, type, interval_days, next_due_date, is_active, created_at, updated_at"
    )
    .maybeSingle()
    .returns<CareTaskRow | null>();

  if (error) {
    return {
      ok: false,
      code: "network_error",
      message: "Care task could not be updated."
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "not_found",
      message: "Care task not found."
    };
  }

  await syncTaskReminderSafely(data.id);

  return {
    ok: true,
    data: toCareTask(data)
  };
}

// One-tap adjustment offered by a weather tip (rain → snooze, heat → advance).
// Always user-confirmed by the tap itself; never applied silently.
export async function applyWeatherCareAdjustment({
  taskId,
  kind,
  days
}: {
  taskId: string;
  kind: "snooze_watering" | "advance_watering";
  days: number;
}): Promise<CareResult<CareTask>> {
  const normalizedTaskId = normalizeId(taskId);
  const roundedDays = Math.round(days);

  if (!normalizedTaskId || !Number.isFinite(roundedDays) || roundedDays < 1 || roundedDays > 7) {
    return {
      ok: false,
      code: "invalid_input",
      message: "That care adjustment is not valid."
    };
  }

  const userResult = await getCurrentUser();

  if (!userResult.ok) {
    return {
      ok: false,
      code: "auth_required",
      message: userResult.message
    };
  }

  const supabase = getSupabaseClient();
  const { data: taskRow, error: taskError } = await supabase
    .from("care_tasks")
    .select(
      "id, user_plant_id, user_id, type, interval_days, next_due_date, is_active, created_at, updated_at"
    )
    .eq("id", normalizedTaskId)
    .eq("user_id", userResult.user.id)
    .maybeSingle()
    .returns<CareTaskRow | null>();

  if (taskError) {
    return {
      ok: false,
      code: "network_error",
      message: "Care task could not be loaded."
    };
  }

  if (!taskRow) {
    return {
      ok: false,
      code: "not_found",
      message: "Care task not found."
    };
  }

  const today = getLocalDateString();
  const nextDueDate =
    kind === "snooze_watering"
      ? addDaysToLocalDate(roundedDays)
      : (() => {
          const advanced = addDaysToLocalDate(-roundedDays, parseLocalDate(taskRow.next_due_date));

          return advanced < today ? today : advanced;
        })();

  const { data, error } = await supabase
    .from("care_tasks")
    .update({ next_due_date: nextDueDate })
    .eq("id", normalizedTaskId)
    .eq("user_id", userResult.user.id)
    .select(
      "id, user_plant_id, user_id, type, interval_days, next_due_date, is_active, created_at, updated_at"
    )
    .maybeSingle()
    .returns<CareTaskRow | null>();

  if (error || !data) {
    return {
      ok: false,
      code: "network_error",
      message: "The schedule change could not be saved."
    };
  }

  await syncTaskReminderSafely(data.id);

  return {
    ok: true,
    data: toCareTask(data)
  };
}

async function syncTaskReminderSafely(taskId: string) {
  try {
    await syncCareTaskReminder(taskId);
  } catch {
    // Local reminder sync should not fail the database write it follows.
  }
}

async function syncPlantRemindersSafely(userPlantId: string) {
  try {
    await syncCareTasksForPlant(userPlantId);
  } catch {
    // Local reminder sync should not fail default care schedule creation.
  }
}

export function formatCareType(type: CareLogType | CareTaskType) {
  switch (type) {
    case "water":
      return "Water";
    case "fertilize":
      return "Fertilize";
    case "repot":
      return "Repot";
    case "prune":
      return "Prune";
    case "rotate":
      return "Rotate";
    case "mist":
      return "Mist";
    case "check_diagnosis":
      return "Diagnosis check";
    case "note":
      return "Note";
    case "growth_photo":
      return "Growth photo";
  }
}
