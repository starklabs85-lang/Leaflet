import {
  AppState,
  type AppStateStatus
} from "react-native";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { env } from "@/lib/env";

type ConnectivityStatus = "checking" | "online" | "offline";

type ConnectivityContextValue = {
  checkNow: () => Promise<void>;
  isOffline: boolean;
  status: ConnectivityStatus;
};

const CHECK_INTERVAL_MS = 30000;
const CHECK_TIMEOUT_MS = 4500;

const ConnectivityContext = createContext<ConnectivityContextValue | null>(null);

export function ConnectivityProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<ConnectivityStatus>("checking");

  const checkNow = useCallback(async () => {
    const online = await checkSupabaseReachability();
    setStatus(online ? "online" : "offline");
  }, []);

  useEffect(() => {
    checkNow();

    const interval = setInterval(checkNow, CHECK_INTERVAL_MS);
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState === "active") {
          checkNow();
        }
      }
    );

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [checkNow]);

  const value = useMemo<ConnectivityContextValue>(
    () => ({
      checkNow,
      isOffline: status === "offline",
      status
    }),
    [checkNow, status]
  );

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity() {
  const context = useContext(ConnectivityContext);

  if (!context) {
    throw new Error("useConnectivity must be used inside ConnectivityProvider.");
  }

  return context;
}

async function checkSupabaseReachability() {
  if (!env.supabaseUrl) {
    return true;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.supabaseUrl}/auth/v1/health`, {
      method: "GET",
      signal: controller.signal
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
