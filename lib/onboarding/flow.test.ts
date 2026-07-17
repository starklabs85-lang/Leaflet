import assert from "node:assert/strict";
import test from "node:test";

import {
  getOnboardingEntryRoute,
  normalizeDisplayName,
  requiresPermanentIdentity
} from "./flow.js";

test("normalizes a required display name", () => {
  assert.equal(normalizeDisplayName("  Arnab   Roy  "), "Arnab Roy");
  assert.equal(normalizeDisplayName("   "), null);
  assert.equal(normalizeDisplayName("a".repeat(81)), null);
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
