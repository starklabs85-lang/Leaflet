export type PersistedOnboardingStatus =
  | "needs_onboarding"
  | "skipped"
  | "complete";

export function getWelcomeOnboardingCompletionMethod() {
  return "welcome";
}

export function getOnboardingEntryRoute(status: PersistedOnboardingStatus) {
  return status === "needs_onboarding"
    ? "/(public)/onboarding/welcome"
    : "/(auth)/(tabs)/home";
}

export function requiresPermanentIdentity(isAnonymous: boolean) {
  return isAnonymous;
}
