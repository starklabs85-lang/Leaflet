import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProviderRequest,
  deliverWithTimeout,
  dispatchChannel,
  dispatchReservation
} from "./delivery.ts";
import { deliveryInput, reservation } from "./test-fixtures.ts";

const secret = "0123456789abcdef0123456789abcdef";

test("provider request signs the fixed body, timestamp, and delivery key", async () => {
  const payload = {
    appId: "fernly" as const,
    environment: "production" as const,
    category: "production_canary" as const,
    code: "controlled_test" as const,
    severity: "critical" as const,
    dedupeLabel: "fernly-incident-eabf86951d6109555dcd82ab",
    occurrenceCount: 1,
    deliveryKey: "fernly-incident-eabf86951d6109555dcd82ab",
    occurredAt: "2026-08-11T00:00:00.000Z"
  };
  const request = await buildProviderRequest(
    "https://provider.invalid/fernly",
    secret,
    payload,
    "2026-08-11T00:02:00.000Z"
  );

  assert.equal(request.headers.get("x-starklabs-app-id"), "fernly");
  assert.equal(request.headers.get("x-starklabs-timestamp"), "2026-08-11T00:02:00.000Z");
  assert.equal(
    request.headers.get("x-starklabs-nonce"),
    "fernly-incident-eabf86951d6109555dcd82ab"
  );
  assert.equal(
    request.headers.get("x-starklabs-signature"),
    "sha256=f21fbce54d4528a50e13b7dec1d0af9fb02ee47c129ee290724434d7e142af01"
  );
  assert.deepEqual(await request.json(), {
    nonce: payload.deliveryKey,
    payload,
    signature: "sha256=f21fbce54d4528a50e13b7dec1d0af9fb02ee47c129ee290724434d7e142af01",
    timestamp: "2026-08-11T00:02:00.000Z"
  });
});

test("bounded request reports timeout without exposing an exception", async () => {
  const fetcher = (_request: Request) =>
    new Promise<Response>((_resolve, reject) => {
      _request.signal.addEventListener("abort", () => {
        reject(new DOMException("test timeout details", "AbortError"));
      });
    });

  assert.deepEqual(
    await deliverWithTimeout(
      fetcher,
      new Request("https://provider.invalid", { method: "POST" }),
      5
    ),
    { state: "failed", code: "timeout", retryable: true }
  );
});

test("retryable failures use bounded leases and stop after success", async () => {
  const completions: Array<Record<string, unknown>> = [];
  let leaseAttempt = 0;
  let fetchAttempt = 0;
  const client = {
    rpc: async (name: string, parameters: Record<string, unknown>) => {
      if (name === "lease_fernly_production_delivery") {
        leaseAttempt += 1;
        return { data: leaseAttempt, error: null };
      }

      completions.push(parameters);
      return { data: null, error: null };
    }
  };
  const fetcher = async () => {
    fetchAttempt += 1;
    return new Response(null, { status: fetchAttempt < 3 ? 503 : 204 });
  };

  const result = await dispatchChannel({
    client,
    fetcher,
    incidentId: reservation.incidentId!,
    channel: "provider",
    deliveryKey: reservation.providerDeliveryKey!,
    buildRequest: () => new Request("https://provider.invalid", { method: "POST" }),
    timeoutMs: 50,
    sleep: async () => undefined
  });

  assert.deepEqual(result, { state: "delivered", attempts: 3 });
  assert.equal(fetchAttempt, 3);
  assert.deepEqual(
    completions.map((value) => [value.p_state, value.p_delivery_code, value.p_attempt_count]),
    [
      ["failed", "http_503", 1],
      ["failed", "http_503", 2],
      ["delivered", "accepted", 3]
    ]
  );
});

test("client rejection completes once and is never retried", async () => {
  let leaseCalls = 0;
  const completionStates: unknown[] = [];
  const client = {
    rpc: async (name: string, parameters: Record<string, unknown>) => {
      if (name === "lease_fernly_production_delivery") {
        leaseCalls += 1;
        return { data: leaseCalls, error: null };
      }

      completionStates.push(parameters.p_state);
      return { data: null, error: null };
    }
  };

  const result = await dispatchChannel({
    client,
    fetcher: async () => new Response(null, { status: 401 }),
    incidentId: reservation.incidentId!,
    channel: "jira",
    deliveryKey: reservation.jiraDeliveryKey!,
    buildRequest: () => new Request("https://jira.invalid", { method: "POST" }),
    timeoutMs: 50,
    sleep: async () => undefined
  });

  assert.deepEqual(result, { state: "rejected", attempts: 1 });
  assert.equal(leaseCalls, 1);
  assert.deepEqual(completionStates, ["rejected"]);
});

test("provider HTTP success is accepted only with a fixed sent or duplicate status", async () => {
  let leaseAttempt = 0;
  const completionCodes: unknown[] = [];
  const client = {
    rpc: async (name: string, parameters: Record<string, unknown>) => {
      if (name === "lease_fernly_production_delivery") {
        leaseAttempt += 1;
        return { data: leaseAttempt, error: null };
      }

      completionCodes.push(parameters.p_delivery_code);
      return { data: null, error: null };
    }
  };

  const result = await dispatchChannel({
    client,
    fetcher: async () => Response.json({ status: "unauthorized" }),
    incidentId: reservation.incidentId!,
    channel: "provider",
    deliveryKey: reservation.providerDeliveryKey!,
    buildRequest: () => new Request("https://provider.invalid", { method: "POST" }),
    responseContract: "provider",
    timeoutMs: 50,
    sleep: async () => undefined
  });

  assert.deepEqual(result, { state: "rejected", attempts: 1 });
  assert.deepEqual(completionCodes, ["provider_rejected"]);
});

test("provider failure cannot prevent independent Jira delivery", async () => {
  const attempts = new Map<string, number>();
  const client = {
    rpc: async (name: string, parameters: Record<string, unknown>) => {
      if (name === "lease_fernly_production_delivery") {
        const key = String(parameters.p_delivery_key);
        const attempt = (attempts.get(key) ?? 0) + 1;
        attempts.set(key, attempt);
        return { data: attempt, error: null };
      }

      return { data: null, error: null };
    }
  };
  const fetcher = async (request: Request) => {
    if (request.url.includes("provider.invalid")) {
      throw new TypeError("provider network details");
    }

    return new Response(null, { status: 204 });
  };

  const result = await dispatchReservation(
    client,
    fetcher,
    deliveryInput,
    reservation,
    {
      provider: { url: "https://provider.invalid/fernly", hmacSecret: secret },
      jira: { url: "https://jira.invalid/fernly-webhook" }
    },
    {
      now: () => new Date("2026-08-11T00:02:00.000Z"),
      timeoutMs: 50,
      sleep: async () => undefined
    }
  );

  assert.deepEqual(result, {
    provider: { state: "failed", attempts: 3 },
    jira: { state: "delivered", attempts: 1 }
  });
});

test("a missing provider configuration cannot suppress configured Jira delivery", async () => {
  const channels: string[] = [];
  const client = {
    rpc: async (name: string, parameters: Record<string, unknown>) => {
      if (name === "lease_fernly_production_delivery") {
        channels.push(String(parameters.p_channel));
        return { data: 1, error: null };
      }

      return { data: null, error: null };
    }
  };

  const result = await dispatchReservation(
    client,
    async () => new Response(null, { status: 204 }),
    deliveryInput,
    reservation,
    {
      provider: null,
      jira: { url: "https://jira.invalid/fernly-webhook" }
    },
    {
      now: () => new Date("2026-08-11T00:02:00.000Z"),
      timeoutMs: 50,
      sleep: async () => undefined
    }
  );

  assert.deepEqual(result, {
    provider: { state: "skipped", attempts: 0 },
    jira: { state: "delivered", attempts: 1 }
  });
  assert.deepEqual(channels, ["jira"]);
});
