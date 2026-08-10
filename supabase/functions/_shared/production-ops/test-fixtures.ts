import type { ReservationDecision } from "./reservation.ts";
import type { IncidentInput } from "./types.ts";

export const deliveryInput: IncidentInput = {
  appId: "fernly",
  environment: "production",
  category: "production_canary",
  code: "controlled_test",
  severity: "critical",
  occurredAt: "2026-08-11T00:00:00.000Z",
  nonce: "0123456789abcdef0123456789abcdef",
  idempotencyKey: "abcdef0123456789abcdef0123456789"
};

export const reservation: ReservationDecision = {
  incidentId: "1f00d4bd-82fa-4f88-a1ff-cbd0935b92ef",
  state: "reserved",
  dedupeLabel: "fernly-incident-eabf86951d6109555dcd82ab",
  occurrenceCount: 1,
  providerDeliveryKey: "fernly-incident-eabf86951d6109555dcd82ab",
  jiraDeliveryKey: "fernly-incident-eabf86951d6109555dcd82ab-00000001",
  sendProvider: true,
  sendJira: true
};
