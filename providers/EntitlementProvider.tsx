import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { AppState } from "react-native";
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage
} from "react-native-purchases";

import {
  addCustomerInfoListener,
  configurePurchases,
  FREE_ENTITLEMENT,
  getCurrentOffering,
  getCustomerInfoSafe,
  isEligibleForIntroTrial,
  logInPurchases,
  logOutPurchases,
  presentSubscriptionOfferCodeRedemption,
  purchasePremiumPackage,
  restorePremiumPurchases,
  toEntitlementSnapshot,
  type EntitlementSnapshot,
  type OfferCodeRedemptionOutcome,
  type PurchaseOutcome,
  type RestoreOutcome
} from "@/lib/payments/revenuecat";
import { useAuth } from "@/providers/AuthProvider";

type EntitlementContextValue = EntitlementSnapshot & {
  isLoading: boolean;
  offering: PurchasesOffering | null;
  monthlyPackage: PurchasesPackage | null;
  annualPackage: PurchasesPackage | null;
  trialEligibilityByProductId: Record<string, boolean>;
  purchase: (pkg: PurchasesPackage) => Promise<PurchaseOutcome>;
  restore: () => Promise<RestoreOutcome>;
  redeemOfferCode: () => Promise<OfferCodeRedemptionOutcome>;
  refresh: () => Promise<void>;
};

const EntitlementContext = createContext<EntitlementContextValue | null>(null);

/**
 * App-wide premium state. RevenueCat CustomerInfo is the live source of truth
 * (`entitlements.active['premium']`); failures keep the last snapshot and
 * degrade to safe free behavior. Must render inside AuthProvider so the
 * RevenueCat identity follows the Supabase session.
 */
export function EntitlementProvider({ children }: PropsWithChildren) {
  const { status, user } = useAuth();
  const [snapshot, setSnapshot] = useState<EntitlementSnapshot>(FREE_ENTITLEMENT);
  const [isLoading, setIsLoading] = useState(true);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [trialEligibilityByProductId, setTrialEligibilityByProductId] =
    useState<Record<string, boolean>>({});
  const lastSyncedUserIdRef = useRef<string | null>(null);

  const applyCustomerInfo = useCallback((customerInfo: CustomerInfo | null) => {
    if (customerInfo) {
      setSnapshot(toEntitlementSnapshot(customerInfo));
    }
  }, []);

  const refresh = useCallback(async () => {
    applyCustomerInfo(await getCustomerInfoSafe());
  }, [applyCustomerInfo]);

  // Configure once, subscribe to live entitlement changes (renewals,
  // cancellations, refunds), and refresh when the app returns to foreground.
  useEffect(() => {
    const isConfigured = configurePurchases();

    if (!isConfigured) {
      setIsLoading(false);
      return undefined;
    }

    const removeListener = addCustomerInfoListener(applyCustomerInfo);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh().catch(() => undefined);
      }
    });

    return () => {
      removeListener();
      appStateSubscription.remove();
    };
  }, [applyCustomerInfo, refresh]);

  // Keep the RevenueCat identity aligned with the Supabase session and load
  // offerings + trial eligibility once signed in.
  useEffect(() => {
    if (status === "loading") {
      return;
    }

    let isActive = true;

    async function syncIdentity() {
      try {
        if (status === "authenticated" && user?.id) {
          if (lastSyncedUserIdRef.current !== user.id) {
            lastSyncedUserIdRef.current = user.id;
            applyCustomerInfo(await logInPurchases(user.id));
          } else {
            await refresh();
          }

          const currentOffering = await getCurrentOffering();

          if (!isActive) {
            return;
          }

          setOffering(currentOffering);

          const annual = currentOffering?.annual ?? null;
          const monthly = currentOffering?.monthly ?? null;
          const packages = [monthly, annual].filter(
            (pkg): pkg is PurchasesPackage => Boolean(pkg)
          );
          const eligibilityEntries = await Promise.all(
            packages.map(async (pkg) => [
              pkg.product.identifier,
              await isEligibleForIntroTrial(pkg)
            ] as const)
          );

          if (isActive) {
            setTrialEligibilityByProductId(
              Object.fromEntries(eligibilityEntries)
            );
          }
        } else {
          lastSyncedUserIdRef.current = null;
          await logOutPurchases();

          if (isActive) {
            setSnapshot(FREE_ENTITLEMENT);
            setOffering(null);
            setTrialEligibilityByProductId({});
          }
        }
      } catch {
        // Identity/offering sync failures must never block the app; the
        // customer-info listener and foreground refresh will reconcile.
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    syncIdentity();

    return () => {
      isActive = false;
    };
  }, [applyCustomerInfo, refresh, status, user?.id]);

  const purchase = useCallback(
    async (pkg: PurchasesPackage) => {
      const outcome = await purchasePremiumPackage(pkg);

      if (outcome.status === "purchased") {
        applyCustomerInfo(outcome.customerInfo);
      }

      return outcome;
    },
    [applyCustomerInfo]
  );

  const restore = useCallback(async () => {
    const outcome = await restorePremiumPurchases();

    if (outcome.status === "restored") {
      applyCustomerInfo(outcome.customerInfo);
    }

    return outcome;
  }, [applyCustomerInfo]);

  const redeemOfferCode = useCallback(async () => {
    const outcome = await presentSubscriptionOfferCodeRedemption();

    if (outcome.status === "presented") {
      await refresh();
    }

    return outcome;
  }, [refresh]);

  const value = useMemo<EntitlementContextValue>(
    () => ({
      ...snapshot,
      isLoading,
      offering,
      monthlyPackage: offering?.monthly ?? null,
      annualPackage: offering?.annual ?? null,
      trialEligibilityByProductId,
      purchase,
      restore,
      redeemOfferCode,
      refresh
    }),
    [
      isLoading,
      trialEligibilityByProductId,
      offering,
      purchase,
      redeemOfferCode,
      refresh,
      restore,
      snapshot
    ]
  );

  return (
    <EntitlementContext.Provider value={value}>
      {children}
    </EntitlementContext.Provider>
  );
}

export function useEntitlement() {
  const context = useContext(EntitlementContext);

  if (!context) {
    throw new Error("useEntitlement must be used inside EntitlementProvider.");
  }

  return context;
}
