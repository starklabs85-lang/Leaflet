import {
  buildJiraPayload,
  buildProviderPayload,
  type JiraPayload,
  type ProviderPayload
} from "./payload.ts";
import type { PagingRpcClient, ReservationDecision } from "./reservation.ts";
import type { IncidentInput } from "./types.ts";

type Fetcher = (request: Request) => Promise<Response>;
type Channel = "provider" | "jira";
type CompletionState = "delivered" | "failed" | "rejected";

export type DeliveryAttempt = {
  state: CompletionState;
  code: string;
  retryable: boolean;
};

export type DispatchResult = {
  state: CompletionState | "skipped";
  attempts: number;
};

type DispatchClient = PagingRpcClient;

function fixedFailure(): never {
  throw new Error("production_ops_unavailable");
}

function requireHttpsUrl(value: string) {
  const url = new URL(value);

  if (url.protocol !== "https:") {
    return fixedFailure();
  }

  return url.toString();
}

async function hmacHex(secret: string, value: string) {
  if (secret.length < 32) {
    return fixedFailure();
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function buildProviderRequest(
  url: string,
  hmacSecret: string,
  payload: ProviderPayload,
  timestamp: string
) {
  const payloadBody = JSON.stringify(payload);
  const signature = await hmacHex(
    hmacSecret,
    `${timestamp}.${payload.deliveryKey}.${payloadBody}`
  );
  const formattedSignature = `sha256=${signature}`;
  const body = JSON.stringify({
    nonce: payload.deliveryKey,
    payload,
    signature: formattedSignature,
    timestamp
  });

  return new Request(requireHttpsUrl(url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Starklabs-App-Id": "fernly",
      "X-Starklabs-Timestamp": timestamp,
      "X-Starklabs-Nonce": payload.deliveryKey,
      "X-Starklabs-Signature": formattedSignature
    },
    body
  });
}

function buildJiraRequest(url: string, payload: JiraPayload) {
  return new Request(requireHttpsUrl(url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function deliverWithTimeout(
  fetcher: Fetcher,
  request: Request,
  timeoutMs: number,
  responseContract?: "provider"
): Promise<DeliveryAttempt> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(new Request(request, { signal: controller.signal }));

    if (response.ok && responseContract === "provider") {
      try {
        const body = await response.json();
        const exactStatus = body !== null &&
          typeof body === "object" &&
          !Array.isArray(body) &&
          Object.keys(body).length === 1 &&
          typeof (body as { status?: unknown }).status === "string"
          ? (body as { status: string }).status
          : null;

        if (exactStatus === "sent" || exactStatus === "duplicate") {
          return { state: "delivered", code: "accepted", retryable: false };
        }

        if (exactStatus === "unauthorized" || exactStatus === "malformed") {
          return { state: "rejected", code: "provider_rejected", retryable: false };
        }
      } catch {
        // A provider response without the fixed JSON contract is retried safely.
      }

      return { state: "failed", code: "provider_invalid_response", retryable: true };
    }

    if (response.ok) {
      return { state: "delivered", code: "accepted", retryable: false };
    }

    if (response.status >= 400 && response.status < 500) {
      return { state: "rejected", code: `http_${response.status}`, retryable: false };
    }

    return { state: "failed", code: `http_${response.status}`, retryable: true };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return {
      state: "failed",
      code: timedOut ? "timeout" : "network_error",
      retryable: true
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function dispatchChannel({
  client,
  fetcher,
  incidentId,
  channel,
  deliveryKey,
  buildRequest,
  responseContract,
  timeoutMs,
  sleep
}: {
  client: DispatchClient;
  fetcher: Fetcher;
  incidentId: string;
  channel: Channel;
  deliveryKey: string;
  buildRequest: () => Request | Promise<Request>;
  responseContract?: "provider";
  timeoutMs: number;
  sleep: (milliseconds: number) => Promise<void>;
}): Promise<DispatchResult> {
  let lastAttempt = 0;
  let lastState: CompletionState = "failed";

  while (lastAttempt < 3) {
    const lease = await client.rpc("lease_fernly_production_delivery", {
      p_app_id: "fernly",
      p_incident_id: incidentId,
      p_channel: channel,
      p_delivery_key: deliveryKey,
      p_lease_seconds: 60
    });

    if (
      lease.error ||
      !Number.isInteger(lease.data) ||
      (lease.data as number) < 0 ||
      (lease.data as number) > 3
    ) {
      return fixedFailure();
    }

    const attempt = lease.data as number;

    if (attempt === 0) {
      return lastAttempt === 0
        ? { state: "skipped", attempts: 0 }
        : { state: lastState, attempts: lastAttempt };
    }

    lastAttempt = attempt;
    const result = await deliverWithTimeout(
      fetcher,
      await buildRequest(),
      timeoutMs,
      responseContract
    );
    lastState = result.state;
    const completion = await client.rpc("complete_fernly_production_delivery", {
      p_app_id: "fernly",
      p_incident_id: incidentId,
      p_channel: channel,
      p_delivery_key: deliveryKey,
      p_state: result.state,
      p_delivery_code: result.code,
      p_attempt_count: attempt
    });

    if (completion.error) {
      return fixedFailure();
    }

    if (!result.retryable || attempt >= 3) {
      return { state: result.state, attempts: attempt };
    }

    await sleep(150 * attempt);
  }

  return { state: lastState, attempts: lastAttempt };
}

async function safeDispatch(task: () => Promise<DispatchResult>): Promise<DispatchResult> {
  try {
    return await task();
  } catch {
    return { state: "failed", attempts: 0 };
  }
}

export async function dispatchReservation(
  client: DispatchClient,
  fetcher: Fetcher,
  input: IncidentInput,
  reservation: ReservationDecision,
  configuration: {
    provider: { url: string; hmacSecret: string } | null;
    jira: { url: string } | null;
  },
  dependencies: {
    now: () => Date;
    timeoutMs: number;
    sleep: (milliseconds: number) => Promise<void>;
  }
) {
  const providerTask = configuration.provider && reservation.sendProvider && reservation.incidentId
    ? safeDispatch(() =>
        dispatchChannel({
          client,
          fetcher,
          incidentId: reservation.incidentId!,
          channel: "provider",
          deliveryKey: reservation.providerDeliveryKey!,
          buildRequest: () =>
            buildProviderRequest(
              configuration.provider!.url,
              configuration.provider!.hmacSecret,
              buildProviderPayload(input, reservation),
              dependencies.now().toISOString()
            ),
          responseContract: "provider",
          timeoutMs: dependencies.timeoutMs,
          sleep: dependencies.sleep
        })
      )
    : Promise.resolve({ state: "skipped", attempts: 0 } as DispatchResult);
  const jiraTask = configuration.jira && reservation.sendJira && reservation.incidentId
    ? safeDispatch(() =>
        dispatchChannel({
          client,
          fetcher,
          incidentId: reservation.incidentId!,
          channel: "jira",
          deliveryKey: reservation.jiraDeliveryKey!,
          buildRequest: () =>
            buildJiraRequest(configuration.jira!.url, buildJiraPayload(input, reservation)),
          timeoutMs: dependencies.timeoutMs,
          sleep: dependencies.sleep
        })
      )
    : Promise.resolve({ state: "skipped", attempts: 0 } as DispatchResult);

  const [provider, jira] = await Promise.all([providerTask, jiraTask]);
  return { provider, jira };
}
