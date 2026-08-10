export const FERNLY_APP_ID = "fernly" as const;
export const PRODUCTION_ENVIRONMENT = "production" as const;
export const INCIDENT_SEVERITY = "critical" as const;

export const INCIDENT_CODES = {
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
  client_primary_action_failed: ["function_error", "network_unavailable"],
  production_canary: ["controlled_test"]
} as const;

export type IncidentCategory = keyof typeof INCIDENT_CODES;
export type IncidentCode = (typeof INCIDENT_CODES)[IncidentCategory][number];

export type IncidentInput = {
  appId: typeof FERNLY_APP_ID;
  environment: typeof PRODUCTION_ENVIRONMENT;
  category: IncidentCategory;
  code: IncidentCode;
  severity: typeof INCIDENT_SEVERITY;
  occurredAt: string;
  nonce: string;
  idempotencyKey: string;
};

export type IncidentParseError = "invalid_incident" | "wrong_app" | "wrong_environment";

export type IncidentParseResult =
  | { ok: true; value: IncidentInput }
  | { ok: false; code: IncidentParseError };
