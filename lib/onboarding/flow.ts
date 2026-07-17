export type PersistedOnboardingStatus =
  | "needs_onboarding"
  | "skipped"
  | "complete";

export function normalizeDisplayName(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");

  return normalized.length >= 2 && normalized.length <= 80
    ? normalized
    : null;
}

export function getOnboardingEntryRoute(status: PersistedOnboardingStatus) {
  return status === "needs_onboarding"
    ? "/(public)/onboarding/welcome"
    : "/(auth)/(tabs)/home";
}

export function requiresPermanentIdentity(isAnonymous: boolean) {
  return isAnonymous;
}
