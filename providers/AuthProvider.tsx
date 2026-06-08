import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import {
  isUserCancelledAuthError,
  signInWithAppleIdToken,
  signInWithDevTestAccount,
  signInWithGoogleIdToken,
  signOutOfNativeProviders
} from "@/lib/auth";
import { getSupabaseConfigIssue, hasSupabaseConfig } from "@/lib/env";
import { getSupabaseClient } from "@/lib/supabase";

type AuthStatus = "loading" | "authenticated" | "signed-out" | "missing-config";
type AuthProviderName = "apple" | "google" | "dev";

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  errorMessage: string | null;
  activeProvider: AuthProviderName | null;
  isLoading: boolean;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithDevTest: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<AuthProviderName | null>(
    null
  );

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setStatus("missing-config");
      setErrorMessage(getSupabaseConfigIssue());
      return;
    }

    const supabase = getSupabaseClient();
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) {
          return;
        }

        if (error) {
          setErrorMessage(error.message);
          setStatus("signed-out");
          return;
        }

        setSession(data.session);
        setStatus(data.session ? "authenticated" : "signed-out");
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(getAuthStartupErrorMessage(error));
        setStatus("signed-out");
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setStatus(nextSession ? "authenticated" : "signed-out");
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const runAuthAction = useCallback(
    async (provider: AuthProviderName, action: () => Promise<void>) => {
      setActiveProvider(provider);
      setErrorMessage(null);

      try {
        await action();
      } catch (error) {
        if (!isUserCancelledAuthError(error)) {
          const message = formatAuthError(error);

          console.warn("Leaflet auth action failed", {
            provider,
            message,
            error
          });
          setErrorMessage(message);
        }
      } finally {
        setActiveProvider(null);
      }
    },
    []
  );

  const signInWithApple = useCallback(
    () => runAuthAction("apple", signInWithAppleIdToken),
    [runAuthAction]
  );

  const signInWithGoogle = useCallback(
    async () =>
      runAuthAction("google", async () => {
        await signInWithGoogleIdToken();
      }),
    [runAuthAction]
  );

  const signInWithDevTest = useCallback(
    () => runAuthAction("dev", signInWithDevTestAccount),
    [runAuthAction]
  );

  const signOut = useCallback(async () => {
    setErrorMessage(null);
    setActiveProvider(null);

    if (!hasSupabaseConfig()) {
      setStatus("missing-config");
      setErrorMessage(getSupabaseConfigIssue());
      return;
    }

    const { error } = await getSupabaseClient().auth.signOut();
    await signOutOfNativeProviders();

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSession(null);
    setStatus("signed-out");
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      errorMessage,
      activeProvider,
      isLoading: status === "loading" || activeProvider !== null,
      signInWithApple,
      signInWithGoogle,
      signInWithDevTest,
      signOut,
      clearError
    }),
    [
      activeProvider,
      clearError,
      errorMessage,
      session,
      signInWithApple,
      signInWithGoogle,
      signInWithDevTest,
      signOut,
      status
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}

// Surfaces the native status code from @react-native-google-signin so a
// generic "Sign in failed" becomes diagnosable. DEVELOPER_ERROR (10) almost
// always means the package name + signing SHA-1 are not registered on an
// Android OAuth client in Google Cloud (or haven't propagated yet).
function formatAuthError(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code: unknown }).code)
      : null;

  const message =
    error instanceof Error ? error.message : "Sign-in failed. Please try again.";

  if (code === "DEVELOPER_ERROR" || code === "10") {
    return "Sign-in failed (DEVELOPER_ERROR): the app's package name and signing SHA-1 are not registered on an Android OAuth client in Google Cloud.";
  }

  return code ? `${message} (code: ${code})` : message;
}

function getAuthStartupErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Leaflet could not restore your session. Please sign in again.";
}
