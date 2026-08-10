import assert from "node:assert/strict";
import test from "node:test";

import { reserveProductionIncident } from "./reservation.ts";
import type { IncidentInput } from "./types.ts";

const input: IncidentInput = {
  appId: "fernly",
  environment: "production",
  category: "production_canary",
  code: "controlled_test",
  severity: "critical",
  occurredAt: "2026-08-11T00:00:00.000Z",
  nonce: "0123456789abcdef0123456789abcdef",
  idempotencyKey: "abcdef0123456789abcdef0123456789"
};

test("reserves using only the validated fixed incident fields", async () => {
  let call: { name: string; parameters: Record<string, unknown> } | undefined;
  const client = {
    rpc: async (name: string, parameters: Record<string, unknown>) => {
      call = { name, parameters };
      return {
        data: [
          {
            incident_id: "1f00d4bd-82fa-4f88-a1ff-cbd0935b92ef",
            status: "reserved",
            dedupe_label: "fernly-incident-eabf86951d6109555dcd82ab",
            occurrence_count: 1,
            provider_delivery_key: "fernly-incident-eabf86951d6109555dcd82ab",
            jira_delivery_key: "fernly-incident-eabf86951d6109555dcd82ab-00000001",
            send_provider: true,
            send_jira: true
          }
        ],
        error: null
      };
    }
  };

  const result = await reserveProductionIncident(client, input, {
    providerConfigured: true,
    jiraConfigured: true
  });

  assert.deepEqual(call, {
    name: "reserve_fernly_production_incident",
    parameters: {
      p_app_id: "fernly",
      p_environment: "production",
      p_category: "production_canary",
      p_code: "controlled_test",
      p_severity: "critical",
      p_idempotency_key: "abcdef0123456789abcdef0123456789",
      p_request_nonce: "0123456789abcdef0123456789abcdef",
      p_canonical_digest: "eabf86951d6109555dcd82ab5eeb9708e3900ce1f20e2a87d18ba762c4cb9474",
      p_occurred_at: "2026-08-11T00:00:00.000Z",
      p_provider_configured: true,
      p_jira_configured: true
    }
  });
  assert.deepEqual(result, {
    incidentId: "1f00d4bd-82fa-4f88-a1ff-cbd0935b92ef",
    state: "reserved",
    dedupeLabel: "fernly-incident-eabf86951d6109555dcd82ab",
    occurrenceCount: 1,
    providerDeliveryKey: "fernly-incident-eabf86951d6109555dcd82ab",
    jiraDeliveryKey: "fernly-incident-eabf86951d6109555dcd82ab-00000001",
    sendProvider: true,
    sendJira: true
  });
});

test("reservation failures expose only a fixed operational error", async () => {
  const client = {
    rpc: async () => ({ data: null, error: { message: "database internals must not escape" } })
  };

  await assert.rejects(
    reserveProductionIncident(client, input, {
      providerConfigured: true,
      jiraConfigured: true
    }),
    { message: "production_ops_unavailable" }
  );
});
