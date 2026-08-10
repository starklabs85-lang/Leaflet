import type { ReservationDecision } from "./reservation.ts";
import type { IncidentInput } from "./types.ts";

function requireValue(value: string | null) {
  if (!value) {
    throw new Error("production_ops_unavailable");
  }

  return value;
}

export function buildProviderPayload(input: IncidentInput, reservation: ReservationDecision) {
  return {
    appId: input.appId,
    environment: input.environment,
    category: input.category,
    code: input.code,
    severity: input.severity,
    dedupeLabel: requireValue(reservation.dedupeLabel),
    occurrenceCount: reservation.occurrenceCount,
    deliveryKey: requireValue(reservation.providerDeliveryKey),
    occurredAt: input.occurredAt
  } as const;
}

export function buildJiraPayload(input: IncidentInput, reservation: ReservationDecision) {
  return {
    appId: input.appId,
    environment: input.environment,
    category: input.category,
    code: input.code,
    severity: input.severity,
    dedupeLabel: requireValue(reservation.dedupeLabel),
    occurrenceCount: reservation.occurrenceCount,
    deliveryKey: requireValue(reservation.jiraDeliveryKey),
    occurredAt: input.occurredAt,
    auditAction:
      reservation.state === "reserved" && reservation.occurrenceCount === 1
        ? "FERNLY_JIRA_CREATE"
        : "FERNLY_JIRA_UPDATE"
  } as const;
}

export type ProviderPayload = ReturnType<typeof buildProviderPayload>;
export type JiraPayload = ReturnType<typeof buildJiraPayload>;
