import { useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { PurchasesPackage } from "react-native-purchases";

import { Button } from "@/components/ui/Button";
import { PressableScale } from "@/components/ui/PressableScale";
import { theme } from "@/constants/theme";
import { FREE_LIMITS } from "@/lib/payments/limits";
import { useEntitlement } from "@/providers/EntitlementProvider";

type ComparisonRow = {
  feature: string;
  free: string;
  premium: string;
};

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    feature: "Plant identification",
    free: `${FREE_LIMITS.identifyScansPerDay}/day`,
    premium: "Unlimited"
  },
  {
    feature: "Disease diagnosis",
    free: "Premium only",
    premium: "Unlimited"
  },
  {
    feature: "Save plants",
    free: "Premium only",
    premium: "Included"
  },
  {
    feature: "Care information",
    free: "Premium only",
    premium: "Included"
  },
  { feature: "Collection dashboard", free: "Premium only", premium: "Included" },
  { feature: "Care schedules & reminders", free: "Premium only", premium: "Included" },
  { feature: "Weather-aware care tips", free: "Premium only", premium: "Included" },
  { feature: "Growth photo timeline", free: "Premium only", premium: "Included" }
];

type PremiumContentProps = {
  /** Called after a successful purchase (e.g. continue the onboarding flow). */
  onPurchased?: () => void;
};

export function PremiumContent({ onPurchased }: PremiumContentProps) {
  const {
    isPremium,
    expiresAt,
    isLoading,
    monthlyPackage,
    annualPackage,
    trialEligibilityByProductId,
    purchase,
    restore,
    redeemOfferCode
  } = useEntitlement();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual">("annual");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRedeemingCode, setIsRedeemingCode] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedPackage =
    selectedPlan === "annual" ? (annualPackage ?? monthlyPackage) : monthlyPackage;
  const selectedPackagePeriod =
    selectedPackage?.product.identifier === annualPackage?.product.identifier
      ? "year"
      : "month";
  const selectedPackageTrialEligible = selectedPackage
    ? trialEligibilityByProductId[selectedPackage.product.identifier] === true
    : false;
  const annualSavingPercent = getAnnualSavingPercent(monthlyPackage, annualPackage);

  async function handlePurchase() {
    if (!selectedPackage || isPurchasing) {
      return;
    }

    setIsPurchasing(true);
    setFeedback(null);

    const outcome = await purchase(selectedPackage);

    setIsPurchasing(false);

    if (outcome.status === "purchased") {
      setFeedback("Welcome to Premium! Everything is unlocked.");
      onPurchased?.();
      return;
    }

    if (outcome.status === "error") {
      setFeedback(outcome.message);
    }
  }

  async function handleRestore() {
    if (isRestoring) {
      return;
    }

    setIsRestoring(true);
    setFeedback(null);

    const outcome = await restore();

    setIsRestoring(false);

    if (outcome.status === "restored") {
      setFeedback("Your Premium subscription has been restored.");
      return;
    }

    if (outcome.status === "nothing_to_restore") {
      // Neutral by design — finding no purchase is not an error.
      setFeedback("No previous purchases were found for this account.");
      return;
    }

    setFeedback(outcome.message);
  }

  async function handleRedeemOfferCode() {
    if (isRedeemingCode) {
      return;
    }

    setIsRedeemingCode(true);
    setFeedback(null);

    const outcome = await redeemOfferCode();

    setIsRedeemingCode(false);

    if (outcome.status === "presented") {
      setFeedback(
        "If the code was redeemed, Premium will update after the store confirms it."
      );
      return;
    }

    setFeedback(outcome.message);
  }

  if (isPremium) {
    return (
      <View style={styles.premiumActiveCard}>
        <MaterialCommunityIcons
          color={theme.colors.leaf}
          name="leaf-circle"
          size={44}
        />
        <Text style={styles.premiumActiveTitle}>You're on Premium</Text>
        <Text style={styles.premiumActiveBody}>
          {expiresAt
            ? `Unlimited scans and every care feature are unlocked. Renews or expires ${formatDate(expiresAt)}.`
            : "Unlimited scans and every care feature are unlocked."}
        </Text>
        <Text style={styles.manageHint}>
          Manage or cancel anytime in your app store subscription settings.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ComparisonTable />

      {!isLoading && !monthlyPackage && !annualPackage ? (
        <View style={styles.unavailableCard}>
          <MaterialCommunityIcons
            color={theme.colors.moss}
            name="storefront-outline"
            size={22}
          />
          <Text style={styles.unavailableText}>
            Plans aren't available right now. Please check back soon.
          </Text>
        </View>
      ) : (
        <View style={styles.planSection}>
          {annualPackage ? (
            <PlanOption
              badge={
                annualSavingPercent
                  ? `Save ${annualSavingPercent}%`
                  : "Best value"
              }
              label="Annual"
              priceText={`${annualPackage.product.priceString} / year`}
              selected={selectedPlan === "annual"}
              onPress={() => setSelectedPlan("annual")}
            />
          ) : null}
          {monthlyPackage ? (
            <PlanOption
              label="Monthly"
              priceText={`${monthlyPackage.product.priceString} / month`}
              selected={selectedPlan === "monthly"}
              onPress={() => setSelectedPlan("monthly")}
            />
          ) : null}

          <Button
            accessibilityLabel={
              selectedPackageTrialEligible
                ? "Start 7-day free trial"
                : "Upgrade to Premium"
            }
            disabled={!selectedPackage || isPurchasing}
            gradient
            icon="leaf"
            label={
              isPurchasing
                ? "Connecting to the store..."
                : selectedPackageTrialEligible
                  ? "Start 7-day free trial"
                  : "Upgrade to Premium"
            }
            loading={isPurchasing}
            onPress={handlePurchase}
            style={styles.purchaseButton}
          />
          {selectedPackageTrialEligible ? (
            <Text style={styles.trialHint}>
              Free for 7 days, then {selectedPackage?.product.priceString ?? ""}
              {` per ${selectedPackagePeriod}`}. Cancel
              anytime before the trial ends and you won't be charged.
            </Text>
          ) : null}
        </View>
      )}

      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

      <Button
        accessibilityLabel="Restore previous purchases"
        disabled={isRestoring}
        label={isRestoring ? "Checking purchases..." : "Restore purchases"}
        loading={isRestoring}
        onPress={handleRestore}
        variant="ghost"
      />
      {Platform.OS === "ios" ? (
        <Button
          accessibilityLabel="Redeem App Store offer code"
          disabled={isRedeemingCode}
          label={isRedeemingCode ? "Opening App Store..." : "Redeem offer code"}
          loading={isRedeemingCode}
          onPress={handleRedeemOfferCode}
          variant="ghost"
        />
      ) : null}

      <View style={styles.termsRow}>
        <PressableScale
          accessibilityLabel="Open terms of service"
          accessibilityRole="link"
          haptic={false}
          onPress={() => router.push("/(public)/legal/terms" as never)}
        >
          <Text style={styles.termsLink}>Terms</Text>
        </PressableScale>
        <Text style={styles.termsDivider}>·</Text>
        <PressableScale
          accessibilityLabel="Open privacy policy"
          accessibilityRole="link"
          haptic={false}
          onPress={() => router.push("/(public)/legal/privacy" as never)}
        >
          <Text style={styles.termsLink}>Privacy</Text>
        </PressableScale>
        <Text style={styles.termsDivider}>·</Text>
        <PressableScale
          accessibilityLabel="Open subscription management"
          accessibilityRole="link"
          haptic={false}
          onPress={() => {
            Linking.openURL("https://support.apple.com/118428").catch(
              () => undefined
            );
          }}
        >
          <Text style={styles.termsLink}>Manage subscriptions</Text>
        </PressableScale>
      </View>
      <Text style={styles.storeNote}>
        Subscriptions renew automatically and are billed and managed by your app
        store. Cancel anytime in your store settings.
      </Text>
    </View>
  );
}

function ComparisonTable() {
  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHeader]}>
        <Text style={[styles.tableFeature, styles.tableHeaderText]}>Feature</Text>
        <Text style={[styles.tableValue, styles.tableHeaderText]}>Free</Text>
        <Text style={[styles.tableValue, styles.tableHeaderTextPremium]}>
          Premium
        </Text>
      </View>
      {COMPARISON_ROWS.map((row) => (
        <View key={row.feature} style={styles.tableRow}>
          <Text style={styles.tableFeature}>{row.feature}</Text>
          <Text style={styles.tableValue}>{row.free}</Text>
          <Text style={[styles.tableValue, styles.tableValuePremium]}>
            {row.premium}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PlanOption({
  badge,
  label,
  priceText,
  selected,
  onPress
}: {
  badge?: string;
  label: string;
  priceText: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityLabel={`Choose the ${label} plan, ${priceText}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.planOption, selected ? styles.planOptionSelected : null]}
    >
      <MaterialCommunityIcons
        color={selected ? theme.colors.forest : theme.colors.moss}
        name={selected ? "radiobox-marked" : "radiobox-blank"}
        size={22}
      />
      <View style={styles.planText}>
        <Text style={styles.planLabel}>{label}</Text>
        <Text style={styles.planPrice}>{priceText}</Text>
      </View>
      {badge ? (
        <View style={styles.planBadge}>
          <Text style={styles.planBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

function getAnnualSavingPercent(
  monthly: PurchasesPackage | null,
  annual: PurchasesPackage | null
) {
  if (!monthly || !annual) {
    return null;
  }

  const monthlyYearTotal = monthly.product.price * 12;

  if (monthlyYearTotal <= 0 || annual.product.price >= monthlyYearTotal) {
    return null;
  }

  return Math.round((1 - annual.product.price / monthlyYearTotal) * 100);
}

function formatDate(isoDate: string) {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return "at the end of the current period";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg
  },
  table: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    overflow: "hidden",
    ...theme.shadow.soft
  },
  tableRow: {
    borderTopColor: theme.colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md
  },
  tableHeader: {
    backgroundColor: theme.colors.leafMuted,
    borderTopWidth: 0
  },
  tableHeaderText: {
    ...theme.text.label
  },
  tableHeaderTextPremium: {
    ...theme.text.label,
    color: theme.colors.leaf,
    flex: 1,
    textAlign: "right"
  },
  tableFeature: {
    ...theme.text.bodyMuted,
    color: theme.colors.ink,
    flex: 2
  },
  tableValue: {
    ...theme.text.bodyMuted,
    flex: 1,
    textAlign: "right"
  },
  tableValuePremium: {
    color: theme.colors.leaf,
    fontFamily: theme.typography.fontFamily.bodyBold
  },
  tableFootnote: {
    ...theme.text.caption,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md
  },
  planSection: {
    gap: theme.spacing.md
  },
  planOption: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: theme.spacing.md,
    padding: theme.spacing.lg
  },
  planOptionSelected: {
    backgroundColor: theme.colors.leafMuted,
    borderColor: theme.colors.forest
  },
  planText: {
    flex: 1
  },
  planLabel: {
    ...theme.text.bodyStrong
  },
  planPrice: {
    ...theme.text.bodyMuted,
    marginTop: 2
  },
  planBadge: {
    backgroundColor: theme.colors.honey,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  planBadgeText: {
    color: theme.colors.ochre,
    fontFamily: theme.typography.fontFamily.bodyBlack,
    fontSize: theme.typography.caption
  },
  purchaseButton: {
    marginTop: theme.spacing.sm
  },
  trialHint: {
    ...theme.text.caption,
    textAlign: "center"
  },
  unavailableCard: {
    alignItems: "center",
    backgroundColor: theme.colors.mist,
    borderRadius: theme.radius.card,
    flexDirection: "row",
    gap: theme.spacing.md,
    padding: theme.spacing.lg
  },
  unavailableText: {
    ...theme.text.bodyMuted,
    flex: 1
  },
  feedback: {
    ...theme.text.bodyStrong,
    textAlign: "center"
  },
  termsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center"
  },
  termsLink: {
    ...theme.text.caption,
    color: theme.colors.leaf,
    textDecorationLine: "underline"
  },
  termsDivider: {
    ...theme.text.caption
  },
  storeNote: {
    ...theme.text.caption,
    textAlign: "center"
  },
  premiumActiveCard: {
    alignItems: "center",
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
    ...theme.shadow.soft
  },
  premiumActiveTitle: {
    ...theme.text.title
  },
  premiumActiveBody: {
    ...theme.text.body,
    textAlign: "center"
  },
  manageHint: {
    ...theme.text.caption,
    textAlign: "center"
  }
});
