import { Redirect } from "expo-router";

import { useOnboarding } from "@/providers/OnboardingProvider";
import { useAuth } from "@/providers/AuthProvider";

export default function IndexRoute() {
  const auth = useAuth();
  const onboarding = useOnboarding();

  if (auth.status === "loading" || onboarding.isLoading) {
    return null;
  }

  if (auth.status === "authenticated") {
    if (onboarding.status === "needs_onboarding") {
      return <Redirect href={"/(public)/onboarding/welcome" as never} />;
    }

    return <Redirect href="/(auth)/(tabs)/home" />;
  }

  if (onboarding.status === "needs_onboarding") {
    return <Redirect href={"/(public)/onboarding/welcome" as never} />;
  }

  return <Redirect href="/(public)/sign-in" />;
}
