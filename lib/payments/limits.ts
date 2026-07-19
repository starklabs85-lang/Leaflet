import { getSupabaseClient } from "@/lib/supabase";
import { getIdentificationAccess } from "@/lib/payments/identificationAccess";

/**
 * Client-side Premium checks provide a friendly prompt before a request is
 * wasted. The identify-plant Edge Function independently enforces the same
 * entitlement requirement.
 */

export type LimitCheck =
  | { allowed: true; remaining: number | null }
  | { allowed: false; remaining: 0; message: string };

const UNLIMITED: LimitCheck = { allowed: true, remaining: null };

export async function checkIdentifyScanAllowance(
  isPremium: boolean
): Promise<LimitCheck> {
  return getIdentificationAccess(isPremium);
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
