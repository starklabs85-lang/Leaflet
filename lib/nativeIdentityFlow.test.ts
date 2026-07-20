import assert from "node:assert/strict";
import test from "node:test";

import {
  completeNativeIdentitySignIn,
  type NativeIdentityAuthClient,
  type NativeIdTokenCredentials
} from "./nativeIdentityFlow.js";

const appleCredentials: NativeIdTokenCredentials = {
  provider: "apple",
  token: "apple-token",
  nonce: "apple-nonce"
};

const googleCredentials: NativeIdTokenCredentials = {
  provider: "google",
  token: "google-token",
  access_token: "google-access-token"
};

type Scenario = {
  currentAnonymous?: boolean | null;
  getSessionError?: Error | null;
  linkError?: Error | null;
  linkResultAnonymous?: boolean | null;
  signInError?: Error | null;
  signInResultAnonymous?: boolean | null;
};

function createAuthClient(scenario: Scenario = {}) {
  const calls: string[] = [];
  const credentialsSeen: NativeIdTokenCredentials[] = [];

  const auth: NativeIdentityAuthClient = {
    async getSession() {
      calls.push("getSession");
      return {
        data: {
          session:
            scenario.currentAnonymous === null ||
            scenario.currentAnonymous === undefined
              ? null
              : { user: { is_anonymous: scenario.currentAnonymous } }
        },
        error: scenario.getSessionError ?? null
      };
    },
    async linkIdentity(credentials) {
      calls.push("linkIdentity");
      credentialsSeen.push(credentials);
      return {
        data: {
          session:
            scenario.linkResultAnonymous === null
              ? null
              : { user: { is_anonymous: scenario.linkResultAnonymous ?? false } }
        },
        error: scenario.linkError ?? null
      };
    },
    async signInWithIdToken(credentials) {
      calls.push("signInWithIdToken");
      credentialsSeen.push(credentials);
      return {
        data: {
          session:
            scenario.signInResultAnonymous === null
              ? null
              : { user: { is_anonymous: scenario.signInResultAnonymous ?? false } }
        },
        error: scenario.signInError ?? null
      };
    }
  };

  return { auth, calls, credentialsSeen };
}

for (const credentials of [appleCredentials, googleCredentials]) {
  test(`uses normal ${credentials.provider} sign-in when no session exists`, async () => {
    const { auth, calls, credentialsSeen } = createAuthClient();

    await completeNativeIdentitySignIn(auth, credentials);

    assert.deepEqual(calls, ["getSession", "signInWithIdToken"]);
    assert.deepEqual(credentialsSeen, [credentials]);
  });
}

test("links a provider identity when the current session is anonymous", async () => {
  const { auth, calls, credentialsSeen } = createAuthClient({ currentAnonymous: true });

  await completeNativeIdentitySignIn(auth, googleCredentials);

  assert.deepEqual(calls, ["getSession", "linkIdentity"]);
  assert.deepEqual(credentialsSeen, [googleCredentials]);
});

test("signs into an existing account when anonymous identity linking conflicts", async () => {
  const conflict = Object.assign(new Error("Identity already linked"), {
    code: "identity_already_exists"
  });
  const { auth, calls } = createAuthClient({ currentAnonymous: true, linkError: conflict });

  await completeNativeIdentitySignIn(auth, appleCredentials);

  assert.deepEqual(calls, ["getSession", "linkIdentity", "signInWithIdToken"]);
});

test("surfaces unexpected identity-linking errors", async () => {
  const linkError = new Error("Manual identity linking is disabled");
  const { auth, calls } = createAuthClient({ currentAnonymous: true, linkError });

  await assert.rejects(completeNativeIdentitySignIn(auth, googleCredentials), linkError);
  assert.deepEqual(calls, ["getSession", "linkIdentity"]);
});

test("uses normal sign-in when the current session is already permanent", async () => {
  const { auth, calls } = createAuthClient({ currentAnonymous: false });

  await completeNativeIdentitySignIn(auth, googleCredentials);

  assert.deepEqual(calls, ["getSession", "signInWithIdToken"]);
});

test("requires a permanent session after successful authentication", async () => {
  const { auth } = createAuthClient({ signInResultAnonymous: true });

  await assert.rejects(
    completeNativeIdentitySignIn(auth, appleCredentials),
    /permanent session/i
  );
});

test("surfaces session lookup errors before invoking a provider operation", async () => {
  const sessionError = new Error("Session storage unavailable");
  const { auth, calls } = createAuthClient({ getSessionError: sessionError });

  await assert.rejects(completeNativeIdentitySignIn(auth, googleCredentials), sessionError);
  assert.deepEqual(calls, ["getSession"]);
});
