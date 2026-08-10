import assert from "node:assert/strict";
import test from "node:test";

import { parseClientIncidentInput } from "./clientContract.ts";

test("mobile ingress accepts only fixed client failure codes", () => {
  assert.deepEqual(
    parseClientIncidentInput({
      category: "client_primary_action_failed",
      code: "network_unavailable",
      idempotency_key: "client-action-0000000000000001"
    }),
    {
      ok: true,
      value: {
        category: "client_primary_action_failed",
        code: "network_unavailable",
        idempotencyKey: "client-action-0000000000000001"
      }
    }
  );
});

test("mobile ingress cannot submit server categories or content fields", () => {
  for (const input of [
    {
      category: "identify_failed",
      code: "openai_unavailable",
      idempotency_key: "client-action-0000000000000001"
    },
    {
      category: "client_primary_action_failed",
      code: "network_unavailable",
      idempotency_key: "client-action-0000000000000001",
      message: "free text"
    }
  ]) {
    assert.deepEqual(parseClientIncidentInput(input), {
      ok: false,
      code: "invalid_incident"
    });
  }
});
