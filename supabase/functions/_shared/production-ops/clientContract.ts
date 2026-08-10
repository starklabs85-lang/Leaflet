const IDEMPOTENCY_KEY_PATTERN = /^[a-z0-9][a-z0-9._:-]{15,127}$/i;
const CLIENT_CODES = new Set(["function_error", "network_unavailable"] as const);

export function parseClientIncidentInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, code: "invalid_incident" } as const;
  }

  const record = input as Record<string, unknown>;
  const keys = Object.keys(record).sort();

  if (
    keys.length !== 3 ||
    keys[0] !== "category" ||
    keys[1] !== "code" ||
    keys[2] !== "idempotency_key" ||
    record.category !== "client_primary_action_failed" ||
    typeof record.code !== "string" ||
    !CLIENT_CODES.has(record.code as "function_error" | "network_unavailable") ||
    typeof record.idempotency_key !== "string" ||
    !IDEMPOTENCY_KEY_PATTERN.test(record.idempotency_key)
  ) {
    return { ok: false, code: "invalid_incident" } as const;
  }

  return {
    ok: true,
    value: {
      category: "client_primary_action_failed" as const,
      code: record.code as "function_error" | "network_unavailable",
      idempotencyKey: record.idempotency_key
    }
  } as const;
}
