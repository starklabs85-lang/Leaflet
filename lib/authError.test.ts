import assert from "node:assert/strict";
import test from "node:test";

import { formatAuthError } from "./authError.js";

test("omits an undefined auth error code", () => {
  const error = Object.assign(new Error("Auth session missing!"), {
    code: undefined
  });

  assert.equal(
    formatAuthError(error),
    "Your sign-in session expired. Please try again."
  );
});

test("keeps a defined provider error code", () => {
  const error = Object.assign(new Error("Provider rejected the request"), {
    code: "provider_error"
  });

  assert.equal(
    formatAuthError(error),
    "Provider rejected the request (code: provider_error)"
  );
});

test("formats network errors with a retryable message", () => {
  assert.equal(
    formatAuthError(new Error("Network request failed")),
    "Fernly could not reach the sign-in service. Check your connection and try again."
  );
});
