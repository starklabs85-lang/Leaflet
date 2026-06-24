import { getSupabaseClient } from "@/lib/supabase";

/**
 * Free-tier product limits. The identify cap is enforced server-side in the
 * identify-plant edge function (which reads the `subscriptions` table); these
 * client checks exist so users see a friendly inline prompt before a request
 * is wasted. Other product features are Premium-only at their entry points.
 */
export const FREE_LIMITS = {
  identifyScansPerDay: 1
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
      message: "You've used your free plant scan today. Upgrade to Premium for unlimited scans."
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

  return {
    allowed: false,
    remaining: 0,
    message: "Disease diagnosis is included with Premium."
  };
}

export async function checkCollectionAllowance(
  isPremium: boolean
): Promise<LimitCheck> {
  if (isPremium) {
    return UNLIMITED;
  }

  return {
    allowed: false,
    remaining: 0,
    message: "Saving plants and building a collection are included with Premium."
  };
}

export async function checkGrowthPhotoAllowance({
  isPremium
}: {
  isPremium: boolean;
  userPlantId: string;
}): Promise<LimitCheck> {
  if (isPremium) {
    return UNLIMITED;
  }

  return {
    allowed: false,
    remaining: 0,
    message: "Growth photos are included with Premium."
  };
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
