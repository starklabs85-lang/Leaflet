import {
  FERNLY_APP_ID,
  INCIDENT_CODES,
  INCIDENT_SEVERITY,
  PRODUCTION_ENVIRONMENT,
  type IncidentCategory,
  type IncidentCode,
  type IncidentParseResult
} from "./types.ts";

const EXACT_KEYS = [
  "appId",
  "category",
  "code",
  "environment",
  "idempotencyKey",
  "nonce",
  "occurredAt",
  "severity"
] as const;

const HEX_128_PATTERN = /^[a-f0-9]{32}$/;
const ISO_MILLISECONDS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function hasExactKeys(record: Record<string, unknown>) {
  const keys = Object.keys(record).sort();
  return keys.length === EXACT_KEYS.length && keys.every((key, index) => key === EXACT_KEYS[index]);
}

function isExactIsoTimestamp(value: string) {
  if (!ISO_MILLISECONDS_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

export function parseIncidentRequest(input: unknown): IncidentParseResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, code: "invalid_incident" };
  }

  const record = input as Record<string, unknown>;

  if (!hasExactKeys(record)) {
    return { ok: false, code: "invalid_incident" };
  }

  if (typeof record.appId !== "string" || record.appId !== FERNLY_APP_ID) {
    return typeof record.appId === "string"
      ? { ok: false, code: "wrong_app" }
      : { ok: false, code: "invalid_incident" };
  }

  if (typeof record.environment !== "string" || record.environment !== PRODUCTION_ENVIRONMENT) {
    return typeof record.environment === "string"
      ? { ok: false, code: "wrong_environment" }
      : { ok: false, code: "invalid_incident" };
  }

  if (
    typeof record.category !== "string" ||
    typeof record.code !== "string" ||
    record.severity !== INCIDENT_SEVERITY ||
    typeof record.occurredAt !== "string" ||
    typeof record.nonce !== "string" ||
    typeof record.idempotencyKey !== "string" ||
    !isExactIsoTimestamp(record.occurredAt) ||
    !HEX_128_PATTERN.test(record.nonce) ||
    !HEX_128_PATTERN.test(record.idempotencyKey) ||
    !(record.category in INCIDENT_CODES)
  ) {
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
      appId: FERNLY_APP_ID,
      environment: PRODUCTION_ENVIRONMENT,
      category,
      code: record.code as IncidentCode,
      severity: INCIDENT_SEVERITY,
      occurredAt: record.occurredAt,
      nonce: record.nonce,
      idempotencyKey: record.idempotencyKey
    }
  };
}
