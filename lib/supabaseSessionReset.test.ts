import assert from "node:assert/strict";
import test from "node:test";

import { resetSupabaseSession } from "./supabaseSessionReset.js";

test("removes persisted auth and disposes the client after local sign-out", async () => {
  const calls: string[] = [];

  await resetSupabaseSession({
    signOut: async () => calls.push("sign_out"),
    removePersistedSession: async () => calls.push("remove_storage"),
    disposeClient: async () => calls.push("dispose_client")
  });

  assert.deepEqual(calls, ["sign_out", "remove_storage", "dispose_client"]);
});

test("still removes storage and disposes the client when local sign-out fails", async () => {
  const calls: string[] = [];

  await resetSupabaseSession({
    signOut: async () => {
      calls.push("sign_out");
      throw new Error("session no longer exists");
    },
    removePersistedSession: async () => calls.push("remove_storage"),
    disposeClient: async () => calls.push("dispose_client")
  });

  assert.deepEqual(calls, ["sign_out", "remove_storage", "dispose_client"]);
});
