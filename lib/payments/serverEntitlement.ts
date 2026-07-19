export type ServerSubscription = {
  plan: string | null;
  expires_at: string | null;
};

export const SERVER_ENTITLEMENT_RETRY_DELAYS_MS = [
  0,
  500,
  1_000,
  1_500,
  2_000,
  3_000,
  4_000,
  5_000
] as const;

export function shouldContinueAfterPremiumOutcome(status: string) {
  return status === "purchased" || status === "restored";
}

export function isActiveServerPremium(
  subscription: ServerSubscription | null,
  now = Date.now()
) {
  if (subscription?.plan !== "premium") {
    return false;
  }

  return (
    !subscription.expires_at ||
    Date.parse(subscription.expires_at) > now
  );
}

export async function waitForServerPremiumEntitlement({
  delaysMs = SERVER_ENTITLEMENT_RETRY_DELAYS_MS,
  now = Date.now,
  read,
  wait = delay
}: {
  delaysMs?: readonly number[];
  now?: () => number;
  read: () => Promise<ServerSubscription | null>;
  wait?: (delayMs: number) => Promise<void>;
}) {
  for (const delayMs of delaysMs) {
    if (delayMs > 0) {
      await wait(delayMs);
    }

    if (isActiveServerPremium(await read(), now())) {
      return true;
    }
  }

  return false;
}

function delay(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}
