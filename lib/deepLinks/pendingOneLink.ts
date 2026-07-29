import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  consumePendingDeepLink,
  createPendingDeepLink,
  type DeepLinkIntent,
  type PendingDeepLink
} from "./oneLink";

const PENDING_ONE_LINK_KEY = "fernly.pending_one_link_intent.v1";
const listeners = new Set<() => void>();

export type ReceivedDeepLinkIntent = {
  deferred: boolean;
  intent: DeepLinkIntent;
};

export async function storePendingDeepLink({
  deferred,
  intent
}: ReceivedDeepLinkIntent) {
  const pending = {
    ...createPendingDeepLink(intent),
    deferred
  };

  await AsyncStorage.setItem(PENDING_ONE_LINK_KEY, JSON.stringify(pending));
  listeners.forEach((listener) => listener());
}

export async function takePendingDeepLink(
  now = Date.now()
): Promise<ReceivedDeepLinkIntent | null> {
  const serialized = await AsyncStorage.getItem(PENDING_ONE_LINK_KEY);

  if (!serialized) {
    return null;
  }

  await AsyncStorage.removeItem(PENDING_ONE_LINK_KEY);

  try {
    const pending = JSON.parse(serialized) as PendingDeepLink & {
      deferred?: unknown;
    };
    const { intent } = consumePendingDeepLink(pending, now);

    if (!intent) {
      return null;
    }

    return {
      deferred: pending.deferred === true,
      intent
    };
  } catch {
    return null;
  }
}

export async function clearPendingDeepLink() {
  await AsyncStorage.removeItem(PENDING_ONE_LINK_KEY);
}

export function subscribeToPendingDeepLinks(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
