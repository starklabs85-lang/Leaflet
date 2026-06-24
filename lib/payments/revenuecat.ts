import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage
} from "react-native-purchases";

import { env, hasRevenueCatConfig } from "@/lib/env";

/**
 * Thin wrapper around the RevenueCat SDK so the rest of the app never imports
 * `react-native-purchases` directly. The `premium` entitlement is the one
 * thing the app checks; the durable server record lives in the Supabase
 * `subscriptions` table (fed by the revenuecat-webhook function), never
 * written by the client.
 */

export const PREMIUM_ENTITLEMENT_ID = "premium";

export type PremiumPlan = "free" | "premium";

export type EntitlementSnapshot = {
  isPremium: boolean;
  plan: PremiumPlan;
  expiresAt: string | null;
  willRenew: boolean;
};

export const FREE_ENTITLEMENT: EntitlementSnapshot = {
  isPremium: false,
  plan: "free",
  expiresAt: null,
  willRenew: false
};

let configured = false;

export function isPurchasesConfigured() {
  return configured;
}

/**
 * Configure once at launch, after the native layer is ready. Safe to call when
 * the platform key is missing (returns false; app degrades to free).
 */
export function configurePurchases() {
  if (configured) {
    return true;
  }

  if (!hasRevenueCatConfig()) {
    return false;
  }

  const apiKey =
    Platform.OS === "ios" ? env.revenueCatIosKey : env.revenueCatAndroidKey;

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey });
  configured = true;

  return true;
}

/**
 * Tie the RevenueCat app user to the Supabase auth user so webhooks and
 * cross-device restore resolve to the right account. Must run before
 * entitlements are trusted for a signed-in user.
 */
export async function logInPurchases(supabaseUserId: string) {
  if (!configured) {
    return null;
  }

  const { customerInfo } = await Purchases.logIn(supabaseUserId);

  return customerInfo;
}

export async function logOutPurchases() {
  if (!configured) {
    return;
  }

  const isAnonymous = await Purchases.isAnonymous();

  // logOut throws if the current user is already anonymous.
  if (!isAnonymous) {
    await Purchases.logOut();
  }
}

export function toEntitlementSnapshot(
  customerInfo: CustomerInfo | null
): EntitlementSnapshot {
  const entitlement =
    customerInfo?.entitlements.active[PREMIUM_ENTITLEMENT_ID] ?? null;

  if (!entitlement) {
    return FREE_ENTITLEMENT;
  }

  return {
    isPremium: true,
    plan: "premium",
    expiresAt: entitlement.expirationDate,
    willRenew: entitlement.willRenew
  };
}

export async function getCustomerInfoSafe() {
  if (!configured) {
    return null;
  }

  try {
    return await Purchases.getCustomerInfo();
  } catch {
    // Offline / store hiccup: callers keep the last snapshot (SDK caches it)
    // and degrade to safe free behavior rather than locking the app.
    return null;
  }
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) {
    return null;
  }

  try {
    const offerings = await Purchases.getOfferings();

    return offerings.current;
  } catch {
    return null;
  }
}

export type PurchaseOutcome =
  | { status: "purchased"; customerInfo: CustomerInfo }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export async function purchasePremiumPackage(
  pkg: PurchasesPackage
): Promise<PurchaseOutcome> {
  if (!configured) {
    return {
      status: "error",
      message: "Purchases are not available in this build."
    };
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);

    return { status: "purchased", customerInfo };
  } catch (error) {
    if (isUserCancelledPurchase(error)) {
      return { status: "cancelled" };
    }

    return {
      status: "error",
      message:
        error instanceof Error && error.message
          ? error.message
          : "The purchase could not be completed. Please try again."
    };
  }
}

export type RestoreOutcome =
  | { status: "restored"; customerInfo: CustomerInfo }
  | { status: "nothing_to_restore" }
  | { status: "error"; message: string };

export async function restorePremiumPurchases(): Promise<RestoreOutcome> {
  if (!configured) {
    return {
      status: "error",
      message: "Purchases are not available in this build."
    };
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    const snapshot = toEntitlementSnapshot(customerInfo);

    if (!snapshot.isPremium) {
      return { status: "nothing_to_restore" };
    }

    return { status: "restored", customerInfo };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error && error.message
          ? error.message
          : "Purchases could not be restored. Please try again."
    };
  }
}

export type OfferCodeRedemptionOutcome =
  | { status: "presented" }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

export async function presentSubscriptionOfferCodeRedemption(): Promise<
  OfferCodeRedemptionOutcome
> {
  if (!configured) {
    return {
      status: "unavailable",
      message: "Offer code redemption is not available in this build."
    };
  }

  if (Platform.OS !== "ios") {
    return {
      status: "unavailable",
      message: "Offer code redemption is available only on iOS."
    };
  }

  try {
    await Purchases.presentCodeRedemptionSheet();

    return { status: "presented" };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error && error.message
          ? error.message
          : "The offer code sheet could not be opened. Please try again."
    };
  }
}

/**
 * Whether the signed-in store account is still eligible for the 7-day
 * introductory free trial. Apple grants intro offers once per subscription
 * group per Apple ID, so lapsed users must not be promised "7 days free".
 * Android reports eligibility through the offer itself, so default to true
 * there and let the store sheet show the final terms.
 */
export async function isEligibleForIntroTrial(
  pkg: PurchasesPackage | null
): Promise<boolean> {
  if (!configured || !pkg || !hasIntroPhase(pkg)) {
    return false;
  }

  if (Platform.OS !== "ios") {
    return true;
  }

  try {
    const productId = pkg.product.identifier;
    const eligibilityMap =
      await Purchases.checkTrialOrIntroductoryPriceEligibility([productId]);
    const status = eligibilityMap[productId]?.status;

    // 2 = ELIGIBLE; 0 = UNKNOWN (sandbox often reports unknown — treat as
    // eligible and let StoreKit show the authoritative terms).
    return status === 2 || status === 0;
  } catch {
    return hasIntroPhase(pkg);
  }
}

function hasIntroPhase(pkg: PurchasesPackage) {
  return Boolean(pkg.product.introPrice);
}

export function addCustomerInfoListener(
  listener: (customerInfo: CustomerInfo) => void
) {
  if (!configured) {
    return () => undefined;
  }

  Purchases.addCustomerInfoUpdateListener(listener);

  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

function isUserCancelledPurchase(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "userCancelled" in error &&
    (error as { userCancelled?: unknown }).userCancelled === true
  );
}
