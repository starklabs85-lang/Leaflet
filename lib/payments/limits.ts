import { getSupabaseClient } from "@/lib/supabase";

/**
 * Phase 12 free-tier limits. The identify/diagnose caps are enforced
 * server-side in the identify-plant edge function (which reads the
 * `subscriptions` table); these client checks exist so users see a friendly
 * inline prompt before a request is wasted. Collection and growth-photo caps
 * are enforced here at the save points.
 */
export const FREE_LIMITS = {
  identifyScansPerDay: 5,
  diagnoseScansPerDay: 3,
  plantsInCollection: 10,
  growthPhotosPerPlantPerMonth: 1
} as const;

export type LimitCheck =
  | { allowed: true; remaining: number | null }
  | { allowed: false; remaining: 0; message: string };

const UNLIMITED: LimitCheck = { allowed: true, remaining: null };

export async function checkIdentifyScanAllowance(
  isPremium: boolean
): Promise<LimitCheck> {
  if (isPremium) {
    return UNLIMITED;
  }

  const usage = await getDailyScanUsage();

  // Pre-check only — fail open and let the server enforce.
  if (!usage) {
    return { allowed: true, remaining: null };
  }

  const remaining = FREE_LIMITS.identifyScansPerDay - usage.identifyCount;

  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      message: `You've used your ${FREE_LIMITS.identifyScansPerDay} free identify scans today. Upgrade to Premium for unlimited scans.`
    };
  }

  return { allowed: true, remaining };
}

export async function checkDiagnoseScanAllowance(
  isPremium: boolean
): Promise<LimitCheck> {
  if (isPremium) {
    return UNLIMITED;
  }

  const usage = await getDailyScanUsage();

  if (!usage) {
    return { allowed: true, remaining: null };
  }

  const remaining = FREE_LIMITS.diagnoseScansPerDay - usage.diagnoseCount;

  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      message: `You've used your ${FREE_LIMITS.diagnoseScansPerDay} free diagnosis scans today. Upgrade to Premium for unlimited diagnoses.`
    };
  }

  return { allowed: true, remaining };
}

export async function checkCollectionAllowance(
  isPremium: boolean
): Promise<LimitCheck> {
  if (isPremium) {
    return UNLIMITED;
  }

  const { count, error } = await getSupabaseClient()
    .from("user_plants")
    .select("id", { count: "exact", head: true });

  if (error || count === null) {
    return { allowed: true, remaining: null };
  }

  const remaining = FREE_LIMITS.plantsInCollection - count;

  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      message: `Free accounts can track up to ${FREE_LIMITS.plantsInCollection} plants. Upgrade to Premium for an unlimited collection.`
    };
  }

  return { allowed: true, remaining };
}

export async function checkGrowthPhotoAllowance({
  isPremium,
  userPlantId
}: {
  isPremium: boolean;
  userPlantId: string;
}): Promise<LimitCheck> {
  if (isPremium) {
    return UNLIMITED;
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const { count, error } = await getSupabaseClient()
    .from("care_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_plant_id", userPlantId)
    .eq("task_type", "growth_photo")
    .gte("logged_at", monthStart.toISOString());

  if (error || count === null) {
    return { allowed: true, remaining: null };
  }

  const remaining = FREE_LIMITS.growthPhotosPerPlantPerMonth - count;

  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      message:
        "Free accounts can add 1 growth photo per plant each month. Upgrade to Premium for an unlimited timeline."
    };
  }

  return { allowed: true, remaining };
}

/** Count of plants in the user's collection (used for the first-plant trial trigger). */
export async function getCollectionCount() {
  const { count, error } = await getSupabaseClient()
    .from("user_plants")
    .select("id", { count: "exact", head: true });

  if (error || count === null) {
    return null;
  }

  return count;
}

async function getDailyScanUsage() {
  const { data, error } = await getSupabaseClient().rpc("get_daily_scan_usage");

  if (error || !data?.[0]) {
    return null;
  }

  return {
    identifyCount: Number(data[0].identify_count ?? 0),
    diagnoseCount: Number(data[0].diagnose_count ?? 0)
  };
}
