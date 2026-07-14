type ProfileTrialEligibilityInput = {
  annualProductId?: string;
  monthlyProductId?: string;
  trialEligibilityByProductId: Record<string, boolean>;
};

/**
 * The Profile CTA mirrors the paywall's annual-first plan selection. A missing
 * offering or unresolved eligibility must never promise a free trial.
 */
export function isProfileTrialEligible({
  annualProductId,
  monthlyProductId,
  trialEligibilityByProductId
}: ProfileTrialEligibilityInput) {
  const defaultProductId = annualProductId ?? monthlyProductId;

  return defaultProductId
    ? trialEligibilityByProductId[defaultProductId] === true
    : false;
}
