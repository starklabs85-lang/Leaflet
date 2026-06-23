import { secureStorageAdapter } from "@/lib/secure-storage";

// SecureStore rejects ":" in keys, so namespaces use "." (see OnboardingProvider).
const TRIAL_INTRO_SEEN_KEY = "leaflet.trial_intro_seen";

/**
 * The one-time trial introduction after the first plant is saved. Phase 12's
 * no-nagging rule: once dismissed (or shown at all), it never auto-appears
 * again — the premium screen stays reachable from Profile and limit prompts.
 */
export async function shouldShowTrialIntro() {
  try {
    return (await secureStorageAdapter.getItem(TRIAL_INTRO_SEEN_KEY)) !== "true";
  } catch {
    return false;
  }
}

export async function markTrialIntroSeen() {
  try {
    await secureStorageAdapter.setItem(TRIAL_INTRO_SEEN_KEY, "true");
  } catch {
    // Worst case the intro could show again next first-save; never block saving.
  }
}
