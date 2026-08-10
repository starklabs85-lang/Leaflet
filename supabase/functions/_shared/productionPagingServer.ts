import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import {
  createProviderEnvelope,
  decidePagingState,
  FERNLY_APP_ID,
  type IncidentCategory,
  type IncidentCode,
  type PagingState,
  type ProviderEnvelope
} from "./productionPaging.ts";

const PROVIDER_TIMEOUT_MS = 5_000;
const PROVIDER_MAX_ATTEMPTS = 2;

type Reservation = {
  incident_id: string;
  state: string;
  provider_nonce: string | null;
  occurred_at: string;
};

type ProviderConfiguration = {
  url: string;
  hmacSecret: string;
};

type ReservationState = PagingState | "reserved" | "duplicate" | "cooldown" | "rate_limited";

type ReportInput = {
  adminClient: SupabaseClient;
  category: IncidentCategory;
  code: IncidentCode;
  idempotencyKey: string;
  principalId?: string | null;
  occurredAt?: string;
};

export async function hashPagingPrincipal(principalId: string) {
  const bytes = new TextEncoder().encode(`${FERNLY_APP_ID}:${principalId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function reportTrustedProductionIncident({
  adminClient,
  category,
  code,
  idempotencyKey,
  principalId = null,
  occurredAt = new Date().toISOString()
}: ReportInput): Promise<PagingState | "duplicate" | "cooldown" | "rate_limited" | "error"> {
  try {
    const provider = getProviderConfiguration();
    const principalHash = principalId ? await hashPagingPrincipal(principalId) : null;
    const { data, error } = await adminClient.rpc("reserve_fernly_paging_delivery", {
      p_app_id: FERNLY_APP_ID,
      p_category: category,
      p_code: code,
      p_idempotency_key: idempotencyKey,
      p_principal_hash: principalHash,
      p_occurred_at: occurredAt,
      p_provider_configured: Boolean(provider)
    });

    if (error) {
      return "error";
    }

    const reservation = Array.isArray(data) ? (data[0] as Reservation | undefined) : undefined;

    if (!reservation) {
      return "error";
    }

    const state = reservation.state as ReservationState;

    if (state !== "reserved") {
      return state;
    }

    if (!provider || !reservation.provider_nonce) {
      return "error";
    }

    const envelope = createProviderEnvelope({
      incidentId: reservation.incident_id,
      category,
      code,
      idempotencyKey,
      occurredAt: reservation.occurred_at,
      nonce: reservation.provider_nonce
    });
    const delivery = await deliverToProvider(provider, envelope);

    await adminClient.rpc("record_fernly_paging_delivery", {
      p_app_id: FERNLY_APP_ID,
      p_incident_id: reservation.incident_id,
      p_state: delivery.state,
      p_delivery_code: delivery.code,
      p_attempt_count: delivery.attempts
    });

    return delivery.state === "delivered" ? "ready" : "error";
  } catch {
    return "error";
  }
}

export function reportTrustedProductionIncidentSafely(input: ReportInput) {
  const task = reportTrustedProductionIncident(input).catch(() => undefined);
  const edgeRuntime = (globalThis as {
    EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void };
  }).EdgeRuntime;

  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(task);
    return;
  }

  void task;
}

function getProviderConfiguration(): ProviderConfiguration | null {
  const rawUrl = Deno.env.get("FERNLY_PAGING_PROVIDER_URL")?.trim() ?? "";
  const hmacSecret = Deno.env.get("FERNLY_PAGING_PROVIDER_HMAC_SECRET")?.trim() ?? "";

  if (!rawUrl || !hmacSecret) {
    return null;
  }

  try {
    const url = new URL(rawUrl);

    return url.protocol === "https:" ? { url: url.toString(), hmacSecret } : null;
  } catch {
    return null;
  }
}

async function deliverToProvider(
  provider: ProviderConfiguration,
  envelope: ProviderEnvelope
): Promise<{
  state: "delivered" | "delivery_failed" | "provider_rejected";
  code: string;
  attempts: number;
}> {
  const body = JSON.stringify(envelope);
  const signature = await signProviderEnvelope(provider.hmacSecret, body);
  let lastFailureCode = "network_error";

  for (let attempts = 1; attempts <= PROVIDER_MAX_ATTEMPTS; attempts += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    try {
      const response = await fetch(provider.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Starklabs-App-Id": FERNLY_APP_ID,
          "X-Starklabs-Timestamp": envelope.occurred_at,
          "X-Starklabs-Nonce": envelope.nonce,
          "X-Starklabs-Signature": `sha256=${signature}`
        },
        body,
        signal: controller.signal
      });

      if (response.ok) {
        return { state: "delivered", code: "accepted", attempts };
      }

      if (response.status >= 400 && response.status < 500) {
        return {
          state: "provider_rejected",
          code: `http_${response.status}`,
          attempts
        };
      }

      lastFailureCode = `http_${response.status}`;
    } catch (error) {
      lastFailureCode = error instanceof DOMException && error.name === "AbortError"
        ? "timeout"
        : "network_error";
    } finally {
      clearTimeout(timeout);
    }

    if (attempts < PROVIDER_MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  return {
    state: "delivery_failed",
    code: lastFailureCode,
    attempts: PROVIDER_MAX_ATTEMPTS
  };
}

async function signProviderEnvelope(hmacSecret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(hmacSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
