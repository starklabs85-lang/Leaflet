import assert from "node:assert/strict";
import test from "node:test";

import {
  reportOperationalFailure,
  reportOperationalFailureSafely
} from "./reporter.ts";

test("trusted reporter constructs replay identifiers without user input", async () => {
  let randomCall = 0;
  let parameters: Record<string, unknown> | undefined;
  const dependencies = {
    client: {
      rpc: async (_name: string, input: Record<string, unknown>) => {
        parameters = input;
        return {
          data: [
            {
              incident_id: null,
              status: "disabled",
              dedupe_label: null,
              occurrence_count: 0,
              provider_delivery_key: null,
              jira_delivery_key: null,
              send_provider: false,
              send_jira: false
            }
          ],
          error: null
        };
      }
    },
    provider: null,
    jira: null,
    fetcher: async () => new Response(null, { status: 204 }),
    now: () => new Date("2026-08-11T00:00:00.000Z"),
    randomBytes: () => new Uint8Array(16).fill(++randomCall),
    sleep: async () => undefined,
    timeoutMs: 50
  };

  await reportOperationalFailure(dependencies, "identify_failed", "openai_unavailable");

  assert.equal(parameters?.p_category, "identify_failed");
  assert.equal(parameters?.p_code, "openai_unavailable");
  assert.equal(parameters?.p_request_nonce, "01010101010101010101010101010101");
  assert.equal(parameters?.p_idempotency_key, "02020202020202020202020202020202");
  assert.equal("p_user_id" in (parameters ?? {}), false);
  assert.equal("p_principal_hash" in (parameters ?? {}), false);
});

test("safe reporter absorbs asynchronous paging failure before product response", async () => {
  let waited: Promise<unknown> | undefined;
  const dependencies = {
    client: {
      rpc: async () => ({
        data: null,
        error: { message: "database internals must not escape" }
      })
    },
    provider: null,
    jira: null,
    fetcher: async () => {
      throw new Error("provider internals must not escape");
    },
    now: () => new Date("2026-08-11T00:00:00.000Z"),
    randomBytes: () => new Uint8Array(16),
    sleep: async () => undefined,
    timeoutMs: 50,
    waitUntil: (task: Promise<unknown>) => {
      waited = task;
    }
  };

  const result = reportOperationalFailureSafely(
    dependencies,
    "weather_tips_failed",
    "weather_unavailable"
  );

  assert.equal(result, undefined);
  assert.ok(waited);
  await assert.doesNotReject(waited);
});
