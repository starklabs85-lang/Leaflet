export const FERNLY_APP_ID = "fernly";

const INCIDENT_CODES = {
  identify_failed: [
    "missing_openai_key",
    "openai_unavailable",
    "validation_failed",
    "scan_cache_unavailable",
    "scan_event_unavailable"
  ],
  account_delete_failed: [
    "erasure_queue_failed",
    "erasure_queue_release_failed",
    "storage_cleanup_failed",
    "delete_user_failed"
  ],
  revenuecat_webhook_failed: ["webhook_not_configured", "upsert_failed"],
  weather_tips_failed: ["weather_unavailable", "plants_unavailable"],
  client_primary_action_failed: ["function_error", "network_unavailable"]
} as const;

export type IncidentCategory = keyof typeof INCIDENT_CODES;
export type IncidentCode = (typeof INCIDENT_CODES)[IncidentCategory][number];
export type PagingState = "dormant" | "killed" | "provider_unconfigured" | "ready";

export type SafeIncident = {
  category: IncidentCategory;
  code: IncidentCode;
  idempotencyKey: string;
};

export type ProviderEnvelope = {
  app_id: typeof FERNLY_APP_ID;
  incident_id: string;
  category: IncidentCategory;
  code: IncidentCode;
  idempotency_key: string;
  occurred_at: string;
  nonce: string;
};

const IDEMPOTENCY_KEY_PATTERN = /^[a-z0-9][a-z0-9._:-]{15,127}$/i;

export function parseIncidentInput(
  input: unknown
): { ok: true; value: SafeIncident } | { ok: false; code: "invalid_incident" } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, code: "invalid_incident" };
  }

  const record = input as Record<string, unknown>;
  const keys = Object.keys(record).sort();

  if (
    keys.length !== 3 ||
    keys[0] !== "category" ||
    keys[1] !== "code" ||
    keys[2] !== "idempotency_key"
  ) {
    return { ok: false, code: "invalid_incident" };
  }

  if (
    typeof record.category !== "string" ||
    typeof record.code !== "string" ||
    typeof record.idempotency_key !== "string" ||
    !IDEMPOTENCY_KEY_PATTERN.test(record.idempotency_key)
  ) {
    return { ok: false, code: "invalid_incident" };
  }

  if (!(record.category in INCIDENT_CODES)) {
    return { ok: false, code: "invalid_incident" };
  }

  const category = record.category as IncidentCategory;
  const allowedCodes = INCIDENT_CODES[category] as readonly string[];

  if (!allowedCodes.includes(record.code)) {
    return { ok: false, code: "invalid_incident" };
  }

  return {
    ok: true,
    value: {
      category,
      code: record.code as IncidentCode,
      idempotencyKey: record.idempotency_key
    }
  };
}

// The authenticated public endpoint represents a client-observed failure only.
// Server-only categories are reserved for trusted critical-path reporters.
export function parseClientIncidentInput(input: unknown) {
  const parsed = parseIncidentInput(input);

  if (!parsed.ok || parsed.value.category !== "client_primary_action_failed") {
    return { ok: false, code: "invalid_incident" } as const;
  }

  return parsed;
}

export function decidePagingState({
  enabled,
  killSwitch,
  providerConfigured
}: {
  enabled: boolean;
  killSwitch: boolean;
  providerConfigured: boolean;
}): PagingState {
  if (killSwitch) {
    return "killed";
  }

  if (!enabled) {
    return "dormant";
  }

  return providerConfigured ? "ready" : "provider_unconfigured";
}

export function createProviderEnvelope({
  incidentId,
  category,
  code,
  idempotencyKey,
  occurredAt,
  nonce
}: {
  incidentId: string;
  category: IncidentCategory;
  code: IncidentCode;
  idempotencyKey: string;
  occurredAt: string;
  nonce: string;
}): ProviderEnvelope {
  return {
    app_id: FERNLY_APP_ID,
    incident_id: incidentId,
    category,
    code,
    idempotency_key: idempotencyKey,
    occurred_at: occurredAt,
    nonce
  };
}
