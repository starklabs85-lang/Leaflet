export type DeepLinkIntent =
  | { kind: "home" }
  | { kind: "scan"; mode: "identify" | "diagnose" }
  | { kind: "premium" }
  | { kind: "activation" };

export type PendingDeepLink = {
  createdAt: number;
  intent: DeepLinkIntent;
};

const MAX_DEEP_LINK_VALUE_LENGTH = 100;
const PENDING_DEEP_LINK_TTL_MS = 24 * 60 * 60 * 1000;

export function parseOneLinkPayload(payload: unknown): DeepLinkIntent | null {
  const record = toRecord(payload);
  const nested = toRecord(record?.data);
  const source = nested ?? record;

  if (!source) {
    return null;
  }

  const value = getBoundedString(source.deep_link_value);
  const sub1 = getBoundedString(source.deep_link_sub1);

  if (!value) {
    return null;
  }

  if (value === "home" && !sub1) {
    return { kind: "home" };
  }

  if (value === "premium" && !sub1) {
    return { kind: "premium" };
  }

  if (value === "activation" && !sub1) {
    return { kind: "activation" };
  }

  if (value === "scan" && (sub1 === "identify" || sub1 === "diagnose")) {
    return { kind: "scan", mode: sub1 };
  }

  return null;
}

export function createPendingDeepLink(
  intent: DeepLinkIntent,
  createdAt = Date.now()
): PendingDeepLink {
  return { createdAt, intent };
}

export function consumePendingDeepLink(
  pending: PendingDeepLink | null,
  now = Date.now()
): { intent: DeepLinkIntent | null; remaining: null } {
  if (
    !pending ||
    !Number.isFinite(pending.createdAt) ||
    now - pending.createdAt >= PENDING_DEEP_LINK_TTL_MS ||
    now < pending.createdAt
  ) {
    return { intent: null, remaining: null };
  }

  return { intent: pending.intent, remaining: null };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getBoundedString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();

  if (!trimmed || trimmed.length > MAX_DEEP_LINK_VALUE_LENGTH) {
    return null;
  }

  return trimmed;
}
