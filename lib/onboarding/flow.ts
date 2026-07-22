export type PersistedOnboardingStatus =
  | "needs_onboarding"
  | "skipped"
  | "complete";
export type OnboardingRouteStatus = PersistedOnboardingStatus | "loading";

export type StartupAuthStatus = "authenticated" | "missing-config" | "signed-out";

export function getWelcomeOnboardingCompletionMethod() {
  return "welcome";
}

export function getOnboardingEntryRoute(
  authStatus: StartupAuthStatus,
  _onboardingStatus: OnboardingRouteStatus
) {
  return authStatus === "authenticated"
    ? "/(auth)/(tabs)/home"
    : "/(public)/onboarding/welcome";
}

export function requiresAnonymousOnboarding(
  isAnonymous: boolean,
  onboardingStatus: OnboardingRouteStatus
) {
  return isAnonymous && onboardingStatus === "needs_onboarding";
}

export function requiresPermanentIdentity(isAnonymous: boolean) {
  return isAnonymous;
}
