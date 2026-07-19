import assert from "node:assert/strict";
import test from "node:test";

import {
  getWelcomeOnboardingCompletionMethod,
  getOnboardingEntryRoute,
  requiresPermanentIdentity
} from "./flow.js";

test("marks welcome as the no-name onboarding completion method", () => {
  assert.equal(getWelcomeOnboardingCompletionMethod(), "welcome");
});

test("routes incomplete users to welcome and completed users to home", () => {
  assert.equal(getOnboardingEntryRoute("needs_onboarding"), "/(public)/onboarding/welcome");
  assert.equal(getOnboardingEntryRoute("complete"), "/(auth)/(tabs)/home");
  assert.equal(getOnboardingEntryRoute("skipped"), "/(auth)/(tabs)/home");
});

test("requires a permanent identity before purchasing from an anonymous session", () => {
  assert.equal(requiresPermanentIdentity(true), true);
  assert.equal(requiresPermanentIdentity(false), false);
});
