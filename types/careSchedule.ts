import type { Database } from "@/types/database";

export type CareTaskType =
  Database["public"]["Tables"]["care_tasks"]["Row"]["type"];

export type CareLogType =
  Database["public"]["Tables"]["care_logs"]["Row"]["task_type"];

export type CareDueState = "overdue" | "due_tomorrow" | "upcoming";

export type CareTask = {
  id: string;
  userPlantId: string;
  userId: string;
  type: CareTaskType;
  intervalDays: number;
  nextDueDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  dueState: CareDueState;
  daysUntilDue: number;
};

export type CareLog = {
  id: string;
  userPlantId: string;
  userId: string;
  type: CareLogType;
  note: string | null;
  photoUrl: string | null;
  loggedAt: string;
  createdAt: string;
};

export type GeneratedCareTask = {
  type: CareTaskType;
  intervalDays: number;
  nextDueDate: string;
};

export type CareErrorCode =
  | "auth_required"
  | "invalid_input"
  | "network_error"
  | "not_found";

export type CareResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      code: CareErrorCode;
      message: string;
      rolledBack?: boolean;
    };

export type EnsureCareTasksResult = {
  created: boolean;
  tasks: CareTask[];
};

export type QuickLogResult = {
  log: CareLog;
  updatedTask: CareTask | null;
};

