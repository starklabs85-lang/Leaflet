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
  useRef,
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
const OFFLINE_FAILURE_THRESHOLD = 2;

const ConnectivityContext = createContext<ConnectivityContextValue | null>(null);

export function ConnectivityProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<ConnectivityStatus>("checking");
  const consecutiveFailures = useRef(0);

  const checkNow = useCallback(async () => {
    const online = await checkSupabaseReachability();

    if (online) {
      consecutiveFailures.current = 0;
      setStatus("online");
      return;
    }

    consecutiveFailures.current += 1;

    if (consecutiveFailures.current >= OFFLINE_FAILURE_THRESHOLD) {
      setStatus("offline");
    }
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
      // Supabase routes /auth/v1/* through Kong, which rejects requests
      // without an apikey (HTTP 401). Send the anon key so a healthy
      // backend reports as reachable instead of falsely "offline".
      headers: env.supabaseAnonKey
        ? { apikey: env.supabaseAnonKey }
        : undefined,
      signal: controller.signal
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
