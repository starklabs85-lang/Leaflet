import { Redirect } from "expo-router";

import { getOnboardingEntryRoute } from "@/lib/onboarding/flow";
import { useOnboarding } from "@/providers/OnboardingProvider";
import { useAuth } from "@/providers/AuthProvider";

export default function IndexRoute() {
  const auth = useAuth();
  const onboarding = useOnboarding();

  if (auth.status === "loading" || onboarding.isLoading) {
    return null;
  }

  return (
    <Redirect
      href={getOnboardingEntryRoute(auth.status, onboarding.status) as never}
    />
  );
}
