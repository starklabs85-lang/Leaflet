import type { SignInWithIdTokenCredentials } from "@supabase/supabase-js";

export type NativeIdTokenCredentials = SignInWithIdTokenCredentials;

type AuthErrorLike = {
  code?: string;
  message: string;
};

type NativeIdentitySession = {
  user: {
    is_anonymous?: boolean;
  };
};

type AuthOperationResult = {
  data: {
    session: NativeIdentitySession | null;
  };
  error: AuthErrorLike | null;
};

export type NativeIdentityAuthClient = {
  getSession: () => Promise<AuthOperationResult>;
  linkIdentity: (
    credentials: NativeIdTokenCredentials
  ) => Promise<AuthOperationResult>;
  signInWithIdToken: (
    credentials: NativeIdTokenCredentials
  ) => Promise<AuthOperationResult>;
};

export async function completeNativeIdentitySignIn(
  auth: NativeIdentityAuthClient,
  credentials: NativeIdTokenCredentials
) {
  const current = await auth.getSession();

  if (current.error) {
    throw current.error;
  }

  if (current.data.session?.user.is_anonymous === true) {
    const linked = await auth.linkIdentity(credentials);

    if (!linked.error) {
      requirePermanentSession(linked);
      return "created" as const;
    }

    if (!isExistingIdentityError(linked.error)) {
      throw linked.error;
    }
  }

  const signedIn = await auth.signInWithIdToken(credentials);

  if (signedIn.error) {
    throw signedIn.error;
  }

  requirePermanentSession(signedIn);
  return "returning" as const;
}

function requirePermanentSession(result: AuthOperationResult) {
  if (!result.data.session || result.data.session.user.is_anonymous === true) {
    throw new Error(
      "Fernly could not establish a permanent session. Please try again."
    );
  }
}

function isExistingIdentityError(error: AuthErrorLike) {
  const value = `${error.code ?? ""} ${error.message}`.toLowerCase();

  return (
    value.includes("identity_already_exists") ||
    value.includes("already linked")
  );
}
