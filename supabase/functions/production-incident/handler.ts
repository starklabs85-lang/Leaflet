import { verifyOperationsSignature } from "../_shared/production-ops/auth.ts";
import { canonicalIncident } from "../_shared/production-ops/canonical.ts";
import { parseIncidentRequest } from "../_shared/production-ops/contract.ts";
import type { IncidentInput } from "../_shared/production-ops/types.ts";

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": [
    "content-type",
    "x-fernly-nonce",
    "x-fernly-signature",
    "x-fernly-timestamp"
  ].join(", "),
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json"
};

type ReservationState =
  | "disabled"
  | "dormant"
  | "not_configured"
  | "threshold"
  | "reserved"
  | "duplicate"
  | "cooldown"
  | "rate_limited"
  | "replay_conflict"
  | "idempotency_conflict";

export type IncidentHandlerDependencies = {
  now: () => Date;
  operationsSecret: string;
  reserve: (input: IncidentInput) => Promise<{ state: ReservationState }>;
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders
  });
}

export async function handleProductionIncident(
  request: Request,
  dependencies: IncidentHandlerDependencies
) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: responseHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, code: "method_not_allowed" }, 405);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: "invalid_incident" }, 400);
  }

  const parsed = parseIncidentRequest(body);

  if (!parsed.ok) {
    const status = parsed.code === "invalid_incident" ? 400 : 403;
    return jsonResponse({ ok: false, code: parsed.code }, status);
  }

  if (
    request.headers.get("x-fernly-timestamp") !== parsed.value.occurredAt ||
    request.headers.get("x-fernly-nonce") !== parsed.value.nonce
  ) {
    return jsonResponse({ ok: false, code: "unauthorized" }, 403);
  }

  const auth = await verifyOperationsSignature(
    request.headers,
    canonicalIncident(parsed.value),
    dependencies.now(),
    dependencies.operationsSecret
  );

  if (auth.status !== "authorized") {
    const code = auth.status === "malformed" ? "unauthorized" : auth.status;
    return jsonResponse({ ok: false, code }, 403);
  }

  try {
    const reservation = await dependencies.reserve(parsed.value);
    return jsonResponse({ ok: true, state: reservation.state }, 202);
  } catch {
    return jsonResponse({ ok: false, code: "service_unavailable" }, 503);
  }
}
