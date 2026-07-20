import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
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

import {
  type AppResetReason,
  resetLocalAppState
} from "@/lib/appReset";
import {
  decideInstallAction,
  writeInstallMarkersSafely
} from "@/lib/installState";

type InstallationStatus = "error" | "loading" | "ready" | "resetting";

type ResetRequest = {
  reason: AppResetReason;
  userId?: string | null;
};

type AppInstallationContextValue = {
  errorMessage: string | null;
  generation: number;
  resetToNewUser: (request: ResetRequest) => Promise<void>;
  retry: () => void;
  status: InstallationStatus;
};

const DURABLE_INSTALL_MARKER = "leaflet.install.durable.v1";
const VOLATILE_INSTALL_MARKER = "leaflet.install.volatile.v1";
const MARKER_VALUE = "1";

const AppInstallationContext =
  createContext<AppInstallationContextValue | null>(null);

async function writeInstallMarkers() {
  await writeInstallMarkersSafely({
    writeVolatile: () =>
      AsyncStorage.setItem(VOLATILE_INSTALL_MARKER, MARKER_VALUE),
    writeDurable: () =>
      SecureStore.setItemAsync(DURABLE_INSTALL_MARKER, MARKER_VALUE)
  });
}

export function AppInstallationProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<InstallationStatus>("loading");
  const [generation, setGeneration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pendingResetRef = useRef<ResetRequest | null>(null);

  const runReset = useCallback(async (request: ResetRequest) => {
    pendingResetRef.current = request;
    setStatus("resetting");
    setErrorMessage(null);

    try {
      await resetLocalAppState(request);
      await writeInstallMarkers();
      pendingResetRef.current = null;
      setGeneration((current) => current + 1);
      setStatus("ready");
    } catch {
      setErrorMessage(
        "Fernly could not finish resetting this device. Please try again."
      );
      setStatus("error");
      throw new Error("Fernly could not finish resetting this device.");
    }
  }, []);

  const bootstrap = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const [durableMarker, volatileMarker] = await Promise.all([
        SecureStore.getItemAsync(DURABLE_INSTALL_MARKER),
        AsyncStorage.getItem(VOLATILE_INSTALL_MARKER)
      ]);
      const action = decideInstallAction({
        durableMarker: durableMarker === MARKER_VALUE,
        volatileMarker: volatileMarker === MARKER_VALUE
      });

      if (action === "reset_reinstall") {
        await runReset({ reason: "reinstall" });
        return;
      }

      if (action !== "continue") {
        await writeInstallMarkers();
      }

      setStatus("ready");
    } catch {
      setErrorMessage(
        "Fernly could not check this installation. Please try again."
      );
      setStatus("error");
    }
  }, [runReset]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const retry = useCallback(() => {
    const pendingReset = pendingResetRef.current;

    if (pendingReset) {
      void runReset(pendingReset).catch(() => undefined);
      return;
    }

    void bootstrap();
  }, [bootstrap, runReset]);

  const resetToNewUser = useCallback(
    (request: ResetRequest) => runReset(request),
    [runReset]
  );

  const value = useMemo<AppInstallationContextValue>(
    () => ({ errorMessage, generation, resetToNewUser, retry, status }),
    [errorMessage, generation, resetToNewUser, retry, status]
  );

  return (
    <AppInstallationContext.Provider value={value}>
      {children}
    </AppInstallationContext.Provider>
  );
}

export function useAppInstallation() {
  const context = useContext(AppInstallationContext);

  if (!context) {
    throw new Error(
      "useAppInstallation must be used inside AppInstallationProvider."
    );
  }

  return context;
}
