import { FERNLY_APP_ID, type IncidentInput } from "./types.ts";

export function canonicalIncident(input: IncidentInput) {
  return [
    input.appId,
    input.environment,
    input.category,
    input.code,
    input.severity,
    input.occurredAt,
    input.nonce,
    input.idempotencyKey
  ].join("\n");
}

export async function dedupeLabel(canonical: string) {
  const hex = await canonicalDigest(canonical);

  return `${FERNLY_APP_ID}-incident-${hex.slice(0, 24)}`;
}

export async function canonicalDigest(canonical: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
