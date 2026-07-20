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
  deleteAccount as deleteSupabaseAccount,
  isUserCancelledAuthError,
  signInWithAppleIdToken,
  signInWithGoogleIdToken,
  signOutOfNativeProviders
} from "@/lib/auth";
import { formatAuthError } from "@/lib/authError";
import {
  ANALYTICS_EVENTS,
  clearAnalyticsUser,
  trackAction
} from "@/lib/analytics/firebaseAnalytics";
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
  isAnonymous: boolean;
  hasPermanentIdentity: boolean;
  ensureAnonymousSession: () => Promise<void>;
  signInWithApple: () => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  deleteAccount: () => Promise<void>;
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
    async <T,>(provider: AuthProviderName, action: () => Promise<T>) => {
      setActiveProvider(provider);
      setErrorMessage(null);
      void trackAction(ANALYTICS_EVENTS.SIGN_IN_TAP, { provider });

      try {
        const result = await action();

        if (isCancelledAuthOutcome(result)) {
          void trackAction(ANALYTICS_EVENTS.SIGN_IN_CANCEL, { provider });
          return false;
        }

        void trackAction(ANALYTICS_EVENTS.SIGN_IN_RESULT, {
          provider,
          result: "success"
        });

        return true;
      } catch (error) {
        if (isUserCancelledAuthError(error)) {
          void trackAction(ANALYTICS_EVENTS.SIGN_IN_CANCEL, { provider });
        } else {
          const message = formatAuthError(error);

          console.warn("Fernly auth action failed", {
            provider,
            message,
            error
          });
          void trackAction(ANALYTICS_EVENTS.SIGN_IN_FAILURE, {
            provider,
            reason: getAuthFailureReason(error)
          });
          setErrorMessage(message);
        }
        return false;
      } finally {
        setActiveProvider(null);
      }
    },
    []
  );

  const ensureAnonymousSession = useCallback(async () => {
    if (!hasSupabaseConfig()) {
      throw new Error(getSupabaseConfigIssue() ?? "Supabase is not configured.");
    }

    const supabase = getSupabaseClient();
    const { data: current, error: currentError } = await supabase.auth.getSession();

    if (currentError) throw currentError;
    if (current.session) return;

    const { data, error } = await supabase.auth.signInAnonymously();

    if (error || !data.session) {
      throw error ?? new Error("Fernly could not start a private session.");
    }

    setSession(data.session);
    setStatus("authenticated");
  }, []);

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
      void trackAction(ANALYTICS_EVENTS.SIGN_OUT, { result: "failure" });
      setErrorMessage(error.message);
      return;
    }

    await trackAction(ANALYTICS_EVENTS.SIGN_OUT, { result: "success" });
    await clearAnalyticsUser();
    setSession(null);
    setStatus("signed-out");
  }, []);

  const deleteAccount = useCallback(async () => {
    setErrorMessage(null);
    setActiveProvider(null);

    if (!hasSupabaseConfig()) {
      const message = getSupabaseConfigIssue() ?? "Supabase is not configured.";

      setStatus("missing-config");
      setErrorMessage(message);
      throw new Error(message);
    }

    try {
      await deleteSupabaseAccount();
    } catch (error) {
      const message = formatAccountDeletionError(error);

      void trackAction(ANALYTICS_EVENTS.ACCOUNT_DELETE_RESULT, {
        result: "failure",
        reason: getAuthFailureReason(error)
      });
      setErrorMessage(message);
      throw error instanceof Error ? error : new Error(message);
    }

    const { error: signOutError } = await getSupabaseClient().auth.signOut({
      scope: "local"
    });
    await signOutOfNativeProviders();

    if (signOutError) {
      console.warn("Fernly local sign-out after account deletion failed", {
        message: signOutError.message
      });
    }

    await trackAction(ANALYTICS_EVENTS.ACCOUNT_DELETE_RESULT, {
      result: "success"
    });
    await clearAnalyticsUser();
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
      isAnonymous: session?.user.is_anonymous === true,
      hasPermanentIdentity:
        status === "authenticated" && session?.user.is_anonymous !== true,
      ensureAnonymousSession,
      signInWithApple,
      signInWithGoogle,
      deleteAccount,
      signOut,
      clearError
    }),
    [
      activeProvider,
      clearError,
      deleteAccount,
      errorMessage,
      ensureAnonymousSession,
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

function getAuthStartupErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Fernly could not restore your session. Please sign in again.";
}

function formatAccountDeletionError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Fernly could not delete your account. Please try again.";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("network") ||
    normalized.includes("fetch") ||
    normalized.includes("timeout")
  ) {
    return "Fernly could not reach the account deletion service. Check your connection and try again.";
  }

  return message;
}

function isCancelledAuthOutcome(value: unknown) {
  return (
    typeof value === "object" &&
    value !== null &&
    "cancelled" in value &&
    (value as { cancelled?: unknown }).cancelled === true
  );
}

function getAuthFailureReason(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code: unknown }).code).toLowerCase()
      : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (code === "developer_error" || code === "10") {
    return "developer_error";
  }

  if (message.includes("not configured") || message.includes("missing")) {
    return "missing_config";
  }

  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout")
  ) {
    return "network";
  }

  if (message.includes("not available") || message.includes("unavailable")) {
    return "unavailable";
  }

  return "unknown";
}
