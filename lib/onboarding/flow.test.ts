import assert from "node:assert/strict";
import test from "node:test";

import {
  getWelcomeOnboardingCompletionMethod,
  getOnboardingEntryRoute,
  requiresPermanentIdentity
} from "./flow.js";
import * as onboardingFlow from "./flow.js";

test("marks welcome as the no-name onboarding completion method", () => {
  assert.equal(getWelcomeOnboardingCompletionMethod(), "welcome");
});

test("routes signed-out users to welcome regardless of onboarding state", () => {
  assert.equal(
    getOnboardingEntryRoute("signed-out", "needs_onboarding"),
    "/(public)/onboarding/welcome"
  );
  assert.equal(
    getOnboardingEntryRoute("signed-out", "complete"),
    "/(public)/onboarding/welcome"
  );
  assert.equal(
    getOnboardingEntryRoute("signed-out", "skipped"),
    "/(public)/onboarding/welcome"
  );
});

test("routes authenticated users directly to home", () => {
  assert.equal(
    getOnboardingEntryRoute("authenticated", "needs_onboarding"),
    "/(auth)/(tabs)/home"
  );
  assert.equal(
    getOnboardingEntryRoute("authenticated", "complete"),
    "/(auth)/(tabs)/home"
  );
});

test("only temporary anonymous sessions remain subject to the onboarding guard", () => {
  const requiresAnonymousOnboarding = Reflect.get(
    onboardingFlow,
    "requiresAnonymousOnboarding"
  ) as
    | ((isAnonymous: boolean, status: "complete" | "needs_onboarding") => boolean)
    | undefined;

  assert.equal(typeof requiresAnonymousOnboarding, "function");
  assert.equal(requiresAnonymousOnboarding?.(false, "needs_onboarding"), false);
  assert.equal(requiresAnonymousOnboarding?.(true, "needs_onboarding"), true);
  assert.equal(requiresAnonymousOnboarding?.(true, "complete"), false);
});

test("requires a permanent identity before purchasing from an anonymous session", () => {
  assert.equal(requiresPermanentIdentity(true), true);
  assert.equal(requiresPermanentIdentity(false), false);
});
