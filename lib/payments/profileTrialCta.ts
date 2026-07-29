type ProfileTrialEligibilityInput = {
  monthlyProductId?: string;
  trialEligibilityByProductId: Record<string, boolean>;
};

/**
 * The Profile CTA mirrors the monthly-only paywall. A missing offering or
 * unresolved eligibility must never promise a free trial.
 */
export function isProfileTrialEligible({
  monthlyProductId,
  trialEligibilityByProductId
}: ProfileTrialEligibilityInput) {
  return monthlyProductId
    ? trialEligibilityByProductId[monthlyProductId] === true
    : false;
}
