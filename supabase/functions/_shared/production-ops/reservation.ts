import { canonicalDigest, canonicalIncident } from "./canonical.ts";
import type { IncidentInput } from "./types.ts";

const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const DEDUPE_LABEL_PATTERN = /^fernly-incident-[a-f0-9]{24}$/;
const DELIVERY_KEY_PATTERN = /^[a-z0-9:-]{16,96}$/;

const RESERVATION_STATES = new Set([
  "disabled",
  "dormant",
  "not_configured",
  "threshold",
  "reserved",
  "duplicate",
  "cooldown",
  "rate_limited",
  "replay_conflict",
  "idempotency_conflict"
] as const);

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

type RpcResult = { data: unknown; error: unknown };

export type PagingRpcClient = {
  rpc: (name: string, parameters: Record<string, unknown>) => PromiseLike<RpcResult>;
};

export type ReservationDecision = {
  incidentId: string | null;
  state: ReservationState;
  dedupeLabel: string | null;
  occurrenceCount: number;
  providerDeliveryKey: string | null;
  jiraDeliveryKey: string | null;
  sendProvider: boolean;
  sendJira: boolean;
};

function fixedFailure(): never {
  throw new Error("production_ops_unavailable");
}

function nullableMatch(value: unknown, pattern: RegExp) {
  return value === null || (typeof value === "string" && pattern.test(value));
}

function parseReservation(value: unknown): ReservationDecision {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fixedFailure();
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.status !== "string" ||
    !RESERVATION_STATES.has(record.status as ReservationState) ||
    !nullableMatch(record.incident_id, UUID_PATTERN) ||
    !nullableMatch(record.dedupe_label, DEDUPE_LABEL_PATTERN) ||
    !Number.isInteger(record.occurrence_count) ||
    (record.occurrence_count as number) < 0 ||
    !nullableMatch(record.provider_delivery_key, DELIVERY_KEY_PATTERN) ||
    !nullableMatch(record.jira_delivery_key, DELIVERY_KEY_PATTERN) ||
    typeof record.send_provider !== "boolean" ||
    typeof record.send_jira !== "boolean"
  ) {
    return fixedFailure();
  }

  return {
    incidentId: record.incident_id as string | null,
    state: record.status as ReservationState,
    dedupeLabel: record.dedupe_label as string | null,
    occurrenceCount: record.occurrence_count as number,
    providerDeliveryKey: record.provider_delivery_key as string | null,
    jiraDeliveryKey: record.jira_delivery_key as string | null,
    sendProvider: record.send_provider,
    sendJira: record.send_jira
  };
}

export async function reserveProductionIncident(
  client: PagingRpcClient,
  input: IncidentInput,
  configuration: { providerConfigured: boolean; jiraConfigured: boolean }
) {
  const digest = await canonicalDigest(canonicalIncident(input));
  const { data, error } = await client.rpc("reserve_fernly_production_incident", {
    p_app_id: input.appId,
    p_environment: input.environment,
    p_category: input.category,
    p_code: input.code,
    p_severity: input.severity,
    p_idempotency_key: input.idempotencyKey,
    p_request_nonce: input.nonce,
    p_canonical_digest: digest,
    p_occurred_at: input.occurredAt,
    p_provider_configured: configuration.providerConfigured,
    p_jira_configured: configuration.jiraConfigured
  });

  if (error || !Array.isArray(data) || data.length !== 1) {
    return fixedFailure();
  }

  return parseReservation(data[0]);
}
