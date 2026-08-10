const NONCE_PATTERN = /^[a-f0-9]{32}$/;
const SIGNATURE_PATTERN = /^sha256=([a-f0-9]{64})$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;

export type OperationsAuthResult =
  | { status: "authorized"; timestamp: string; nonce: string }
  | { status: "unauthorized" | "expired" | "malformed" };

function decodeHex(value: string) {
  const output = new Uint8Array(value.length / 2);

  for (let index = 0; index < value.length; index += 2) {
    output[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }

  return output;
}

export async function verifyOperationsSignature(
  headers: Headers,
  canonical: string,
  now: Date,
  secret: string
): Promise<OperationsAuthResult> {
  const timestamp = headers.get("x-fernly-timestamp");
  const nonce = headers.get("x-fernly-nonce");
  const signature = headers.get("x-fernly-signature");
  const signatureMatch = signature?.match(SIGNATURE_PATTERN);

  if (
    !timestamp ||
    !nonce ||
    !signatureMatch ||
    !TIMESTAMP_PATTERN.test(timestamp) ||
    !NONCE_PATTERN.test(nonce) ||
    secret.length < 32
  ) {
    return { status: "malformed" };
  }

  const signedAt = new Date(timestamp);

  if (
    Number.isNaN(signedAt.getTime()) ||
    signedAt.toISOString() !== timestamp ||
    Math.abs(now.getTime() - signedAt.getTime()) > MAX_CLOCK_SKEW_MS
  ) {
    return { status: "expired" };
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const data = new TextEncoder().encode(`${timestamp}.${nonce}.${canonical}`);
  const authorized = await crypto.subtle.verify(
    "HMAC",
    key,
    decodeHex(signatureMatch[1]),
    data
  );

  return authorized
    ? { status: "authorized", timestamp, nonce }
    : { status: "unauthorized" };
}
