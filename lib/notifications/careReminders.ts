import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { secureStorageAdapter } from "@/lib/secure-storage";
import { getSupabaseClient } from "@/lib/supabase";
import type { CareTaskType } from "@/types/careSchedule";
import type { Database } from "@/types/database";
import {
  ANALYTICS_EVENTS,
  trackAction
} from "@/lib/analytics/firebaseAnalytics";

type CareTaskRow = Pick<
  Database["public"]["Tables"]["care_tasks"]["Row"],
  "id" | "user_plant_id" | "type" | "next_due_date" | "is_active"
>;

type PlantRow = Pick<
  Database["public"]["Tables"]["user_plants"]["Row"],
  "id" | "nickname"
>;

type StoredTaskReminder = {
  taskId: string;
  userPlantId: string;
  taskType: CareTaskType;
  nextDueDate: string;
  dueNotificationId: string | null;
  overdueNotificationId: string | null;
  overdueForDueDate: string | null;
};

type ReminderScheduleStore = {
  version: 1;
  tasks: Record<string, StoredTaskReminder>;
};

type ReminderPayload = {
  kind?: unknown;
  taskId?: unknown;
  userPlantId?: unknown;
  taskType?: unknown;
};

export type CareReminderSettings = {
  enabled: boolean;
  permissionStatus: string;
  scheduledCount: number;
};

export type CareReminderResult =
  | {
      ok: true;
      settings: CareReminderSettings;
    }
  | {
      ok: false;
      message: string;
      settings: CareReminderSettings;
    };

export const CARE_REMINDER_CHANNEL_ID = "care-reminders";
// SecureStore rejects ":" in keys; namespaces use "." (alphanumeric, ".", "-", "_" only).
const ENABLED_KEY = "leaflet.care-reminders-enabled";
const PROMPT_SEEN_KEY = "leaflet.care-reminders-prompt-seen";
const SCHEDULE_STORE_KEY = "leaflet.care-reminder-schedule";

let lastHandledNotificationId: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

async function getCurrentUser() {
  const {
    data: { user }
  } = await getSupabaseClient().auth.getUser();

  return user;
}

async function readScheduleStore(): Promise<ReminderScheduleStore> {
  const raw = await secureStorageAdapter.getItem(SCHEDULE_STORE_KEY);

  if (!raw) {
    return { version: 1, tasks: {} };
  }

  try {
    const parsed = JSON.parse(raw) as ReminderScheduleStore;

    if (parsed.version === 1 && parsed.tasks && typeof parsed.tasks === "object") {
      return parsed;
    }
  } catch {
    await secureStorageAdapter.removeItem(SCHEDULE_STORE_KEY);
  }

  return { version: 1, tasks: {} };
}

async function writeScheduleStore(store: ReminderScheduleStore) {
  await secureStorageAdapter.setItem(SCHEDULE_STORE_KEY, JSON.stringify(store));
}

async function readEnabledPreference() {
  return (await SecureStore.getItemAsync(ENABLED_KEY)) === "true";
}

async function writeEnabledPreference(enabled: boolean) {
  await SecureStore.setItemAsync(ENABLED_KEY, enabled ? "true" : "false");
}

async function getPermissionStatus() {
  try {
    const permission = await Notifications.getPermissionsAsync();

    return permission.status;
  } catch {
    return "unavailable";
  }
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(CARE_REMINDER_CHANNEL_ID, {
    name: "Care reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250]
  });
}

function countScheduledNotifications(store: ReminderScheduleStore) {
  return Object.values(store.tasks).reduce((total, task) => {
    return (
      total +
      (task.dueNotificationId ? 1 : 0) +
      (task.overdueNotificationId ? 1 : 0)
    );
  }, 0);
}

export async function getCareReminderSettings(): Promise<CareReminderSettings> {
  const [enabled, permissionStatus, store] = await Promise.all([
    readEnabledPreference(),
    getPermissionStatus(),
    readScheduleStore()
  ]);

  return {
    enabled,
    permissionStatus,
    scheduledCount: countScheduledNotifications(store)
  };
}

export async function shouldPromptForCareReminders() {
  const [enabled, promptSeen] = await Promise.all([
    readEnabledPreference(),
    SecureStore.getItemAsync(PROMPT_SEEN_KEY)
  ]);

  return !enabled && promptSeen !== "true";
}

export async function markCareReminderPromptSeen() {
  await SecureStore.setItemAsync(PROMPT_SEEN_KEY, "true");
}

async function cancelNotification(identifier: string | null | undefined) {
  if (!identifier) {
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // Local notification cleanup should not block care actions.
  }
}

async function cancelStoredTaskReminder(
  taskId: string,
  store?: ReminderScheduleStore,
  persist = true
) {
  const nextStore = store ?? (await readScheduleStore());
  const stored = nextStore.tasks[taskId];

  if (!stored) {
    return nextStore;
  }

  await Promise.all([
    cancelNotification(stored.dueNotificationId),
    cancelNotification(stored.overdueNotificationId)
  ]);
  delete nextStore.tasks[taskId];

  if (persist) {
    await writeScheduleStore(nextStore);
  }

  return nextStore;
}

export async function cancelCareNotificationsForTask(taskId: string) {
  await cancelStoredTaskReminder(taskId);
}

export async function cancelCareNotificationsForPlant(userPlantId: string) {
  const store = await readScheduleStore();
  const taskIds = Object.values(store.tasks)
    .filter((task) => task.userPlantId === userPlantId)
    .map((task) => task.taskId);

  for (const taskId of taskIds) {
    await cancelStoredTaskReminder(taskId, store, false);
  }

  await writeScheduleStore(store);
}

export async function cancelAllCareReminders() {
  const store = await readScheduleStore();
  const identifiers = Object.values(store.tasks).flatMap((task) => [
    task.dueNotificationId,
    task.overdueNotificationId
  ]);

  await Promise.all(identifiers.map(cancelNotification));
  await writeScheduleStore({ version: 1, tasks: {} });
}

export async function resetCareReminderState() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Promise.all([
    SecureStore.deleteItemAsync(ENABLED_KEY),
    SecureStore.deleteItemAsync(PROMPT_SEEN_KEY),
    secureStorageAdapter.removeItem(SCHEDULE_STORE_KEY)
  ]);
  lastHandledNotificationId = null;
}

function parseLocalDate(dateString: string) {
  const [yearText, monthText, dayText] = dateString.split("-");

  return new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
}

function reminderDate(dateString: string, offsetDays = 0) {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + offsetDays);
  date.setHours(9, 0, 0, 0);

  return date;
}

function nextNineAM() {
  const date = new Date();
  date.setHours(9, 0, 0, 0);

  if (date <= new Date()) {
    date.setDate(date.getDate() + 1);
  }

  return date;
}

function formatCareType(type: CareTaskType) {
  switch (type) {
    case "water":
      return "water";
    case "fertilize":
      return "fertilize";
    case "repot":
      return "repot";
    case "prune":
      return "prune";
    case "rotate":
      return "rotate";
    case "mist":
      return "mist";
    case "check_diagnosis":
      return "check";
  }
}

function plantName(plant: PlantRow | null | undefined) {
  return plant?.nickname?.trim() || "your plant";
}

async function scheduleLocalReminder({
  body,
  date,
  task,
  title
}: {
  body: string;
  date: Date;
  task: CareTaskRow;
  title: string;
}) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        kind: "care_task",
        taskId: task.id,
        userPlantId: task.user_plant_id,
        taskType: task.type
      }
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      channelId: CARE_REMINDER_CHANNEL_ID,
      date
    }
  });
}

async function fetchPlantForTask(userPlantId: string, userId: string) {
  const { data } = await getSupabaseClient()
    .from("user_plants")
    .select("id, nickname")
    .eq("id", userPlantId)
    .eq("user_id", userId)
    .maybeSingle()
    .returns<PlantRow | null>();

  return data;
}

async function fetchTaskById(taskId: string) {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const { data } = await getSupabaseClient()
    .from("care_tasks")
    .select("id, user_plant_id, type, next_due_date, is_active")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .maybeSingle()
    .returns<CareTaskRow | null>();

  if (!data) {
    return null;
  }

  return {
    task: data,
    plant: await fetchPlantForTask(data.user_plant_id, user.id)
  };
}

async function scheduleTaskReminder(task: CareTaskRow, plant: PlantRow | null) {
  const store = await readScheduleStore();
  const previous = store.tasks[task.id];

  if (!task.is_active) {
    await cancelStoredTaskReminder(task.id, store);
    return;
  }

  await ensureAndroidChannel();

  const now = new Date();
  const dueAt = reminderDate(task.next_due_date);
  const overdueAt = reminderDate(task.next_due_date, 1);
  const action = formatCareType(task.type);
  const name = plantName(plant);

  if (
    previous?.nextDueDate === task.next_due_date &&
    previous.overdueForDueDate === task.next_due_date &&
    overdueAt <= now
  ) {
    return;
  }

  await cancelStoredTaskReminder(task.id, store);

  const dueNotificationId =
    dueAt > now
      ? await scheduleLocalReminder({
          task,
          date: dueAt,
          title: `Time to ${action} ${name}`,
          body: `${name} needs care today. Tap to log it.`
        })
      : null;

  let overdueNotificationId: string | null = null;
  let overdueForDueDate: string | null = null;

  if (overdueAt > now || dueAt <= now) {
    overdueForDueDate = task.next_due_date;
    overdueNotificationId = await scheduleLocalReminder({
      task,
      date: overdueAt > now ? overdueAt : nextNineAM(),
      title: `Overdue: ${action} ${name}`,
      body: `${name} still needs care. Tap to open the task.`
    });
  }

  const nextStore = await readScheduleStore();
  nextStore.tasks[task.id] = {
    taskId: task.id,
    userPlantId: task.user_plant_id,
    taskType: task.type,
    nextDueDate: task.next_due_date,
    dueNotificationId,
    overdueNotificationId,
    overdueForDueDate
  };
  await writeScheduleStore(nextStore);
}

export async function syncCareTaskReminder(taskId: string) {
  if (!(await readEnabledPreference())) {
    await cancelCareNotificationsForTask(taskId);
    return;
  }

  const permissionStatus = await getPermissionStatus();

  if (permissionStatus !== "granted") {
    return;
  }

  const taskContext = await fetchTaskById(taskId);

  if (!taskContext) {
    await cancelCareNotificationsForTask(taskId);
    return;
  }

  await scheduleTaskReminder(taskContext.task, taskContext.plant);
}

async function fetchActiveTasksForPlant(userPlantId: string) {
  const user = await getCurrentUser();

  if (!user) {
    return [];
  }

  const { data } = await getSupabaseClient()
    .from("care_tasks")
    .select("id, user_plant_id, type, next_due_date, is_active")
    .eq("user_id", user.id)
    .eq("user_plant_id", userPlantId)
    .eq("is_active", true)
    .returns<CareTaskRow[]>();

  const plant = await fetchPlantForTask(userPlantId, user.id);

  return (data ?? []).map((task) => ({ task, plant }));
}

export async function syncCareTasksForPlant(userPlantId: string) {
  if (!(await readEnabledPreference())) {
    return;
  }

  const permissionStatus = await getPermissionStatus();

  if (permissionStatus !== "granted") {
    return;
  }

  const taskContexts = await fetchActiveTasksForPlant(userPlantId);
  await Promise.all(
    taskContexts.map(({ task, plant }) => scheduleTaskReminder(task, plant))
  );
}

export async function rescheduleAllCareRemindersIfEnabled() {
  if (!(await readEnabledPreference())) {
    return;
  }

  const user = await getCurrentUser();

  if (!user || (await getPermissionStatus()) !== "granted") {
    return;
  }

  const { data } = await getSupabaseClient()
    .from("care_tasks")
    .select("id, user_plant_id, type, next_due_date, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .returns<CareTaskRow[]>();

  const plantIds = [...new Set((data ?? []).map((task) => task.user_plant_id))];
  const plantRows =
    plantIds.length === 0
      ? []
      : (
          await getSupabaseClient()
            .from("user_plants")
            .select("id, nickname")
            .eq("user_id", user.id)
            .in("id", plantIds)
            .returns<PlantRow[]>()
        ).data ?? [];
  const plantsById = new Map(plantRows.map((plant) => [plant.id, plant]));

  await Promise.all(
    (data ?? []).map((task) =>
      scheduleTaskReminder(task, plantsById.get(task.user_plant_id) ?? null)
    )
  );
}

export async function requestAndEnableCareReminders(): Promise<CareReminderResult> {
  await markCareReminderPromptSeen();
  let permissionStatus = "unavailable";

  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    const permission =
      existing.status === "granted"
        ? existing
        : await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true
            }
          });

    permissionStatus = permission.status;
  } catch {
    await writeEnabledPreference(false);

    return {
      ok: false,
      message: "Care reminders are unavailable on this device.",
      settings: await getCareReminderSettings()
    };
  }

  if (permissionStatus !== "granted") {
    await writeEnabledPreference(false);

    return {
      ok: false,
      message: "Notification permission was not granted. You can enable reminders later in Settings.",
      settings: await getCareReminderSettings()
    };
  }

  await writeEnabledPreference(true);
  await rescheduleAllCareRemindersIfEnabled();

  return {
    ok: true,
    settings: await getCareReminderSettings()
  };
}

export async function disableCareReminders(): Promise<CareReminderSettings> {
  await writeEnabledPreference(false);
  await cancelAllCareReminders();

  return getCareReminderSettings();
}

export async function setCareRemindersEnabled(enabled: boolean) {
  if (enabled) {
    return requestAndEnableCareReminders();
  }

  return {
    ok: true as const,
    settings: await disableCareReminders()
  };
}

function isCareReminderPayload(data: ReminderPayload): data is {
  kind: "care_task";
  taskId: string;
  userPlantId: string;
  taskType: CareTaskType;
} {
  return (
    data.kind === "care_task" &&
    typeof data.taskId === "string" &&
    typeof data.userPlantId === "string" &&
    typeof data.taskType === "string"
  );
}

function handleNotificationResponse(response: Notifications.NotificationResponse | null) {
  if (!response) {
    return;
  }

  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
    return;
  }

  const notificationId = response.notification.request.identifier;

  if (notificationId === lastHandledNotificationId) {
    return;
  }

  const data = response.notification.request.content.data as ReminderPayload;

  if (data.kind === "weather_alert") {
    lastHandledNotificationId = notificationId;
    void trackAction(ANALYTICS_EVENTS.NOTIFICATION_OPEN, {
      destination:
        typeof data.userPlantId === "string" && data.userPlantId
          ? "plant"
          : "home",
      source: "local_weather"
    });

    if (typeof data.userPlantId === "string" && data.userPlantId) {
      router.push({
        pathname: "/(auth)/plants/[plantId]" as never,
        params: { plantId: data.userPlantId }
      });
    } else {
      router.push("/(auth)/(tabs)/home" as never);
    }

    return;
  }

  if (!isCareReminderPayload(data)) {
    return;
  }

  lastHandledNotificationId = notificationId;
  void trackAction(ANALYTICS_EVENTS.NOTIFICATION_OPEN, {
    destination: "plant",
    source: "local_care"
  });
  router.push({
    pathname: "/(auth)/plants/[plantId]" as never,
    params: { plantId: data.userPlantId }
  });
}

export function useCareReminderNotificationRouting(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    rescheduleAllCareRemindersIfEnabled();

    Notifications.getLastNotificationResponseAsync().then(handleNotificationResponse);

    const notificationSubscription =
      Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        rescheduleAllCareRemindersIfEnabled();
      }
    });

    return () => {
      notificationSubscription.remove();
      appStateSubscription.remove();
    };
  }, [isAuthenticated]);
}
