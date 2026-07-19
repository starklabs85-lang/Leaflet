import assert from "node:assert/strict";
import test from "node:test";

import { getGreetingForHour } from "./greeting.js";

test("uses morning before noon", () => {
  assert.equal(getGreetingForHour(0), "Good morning");
  assert.equal(getGreetingForHour(11), "Good morning");
});

test("uses afternoon from noon through 4:59 PM", () => {
  assert.equal(getGreetingForHour(12), "Good afternoon");
  assert.equal(getGreetingForHour(16), "Good afternoon");
});

test("uses evening from 5 PM", () => {
  assert.equal(getGreetingForHour(17), "Good evening");
  assert.equal(getGreetingForHour(23), "Good evening");
});
