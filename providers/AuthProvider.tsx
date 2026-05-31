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
  signInWithGoogleIdToken,
  signOutOfNativeProviders
} from "@/lib/auth";
import { getSupabaseConfigIssue, hasSupabaseConfig } from "@/lib/env";
import { getSupabaseClient } from "@/lib/supabase";

type AuthStatus = "loading" | "authenticated" | "signed-out" | "missing-config";
type AuthProviderName = "apple" | "google";

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  errorMessage: string | null;
  activeProvider: AuthProviderName | null;
  isLoading: boolean;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
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

    supabase.auth.getSession().then(({ data, error }) => {
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
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Sign-in failed. Please try again."
          );
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
