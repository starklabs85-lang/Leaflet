import type { CareLog, CareTask } from "@/types/careSchedule";
import type { CareStats } from "@/lib/api/careStats";
import type { SavedPlant } from "@/types/plantCollection";

export type DashboardTask = CareTask & {
  plant: SavedPlant | null;
};

export type ConsistencyWeek = {
  key: string;
  label: string;
  completed: number;
  expected: number;
  rate: number;
};

export type DashboardData = {
  plants: SavedPlant[];
  dueTasks: DashboardTask[];
  activeTasks: DashboardTask[];
  careStats: CareStats;
  recentLogs: CareLog[];
  consistencyWeeks: ConsistencyWeek[];
  healthPercentage: number;
  totalPlants: number;
  overdueTasksCount: number;
  plantsNeedingCareCount: number;
};

export type DashboardResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      code: "auth_required" | "network_error";
      message: string;
    };
