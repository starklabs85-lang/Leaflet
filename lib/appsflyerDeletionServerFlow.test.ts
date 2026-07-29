import assert from "node:assert/strict";
import test from "node:test";

import { runAccountDeletionServerFlow } from "../supabase/functions/delete-account/flow";

test("durably queues and releases AppsFlyer erasure before deleting the Supabase user", async () => {
  const calls: string[] = [];

  await runAccountDeletionServerFlow({
    enqueueErasureHeld: async () => {
      calls.push("queue-held");
    },
    deleteStorage: async () => {
      calls.push("delete-storage");
    },
    releaseErasure: async () => {
      calls.push("release-queue");
    },
    revokeSessions: async () => {
      calls.push("revoke-sessions");
    },
    deleteUser: async () => {
      calls.push("delete-user");
    }
  });

  assert.deepEqual(calls, [
    "queue-held",
    "delete-storage",
    "release-queue",
    "revoke-sessions",
    "delete-user"
  ]);
});

test("never deletes a user when the AppsFlyer queue cannot be created", async () => {
  const calls: string[] = [];

  await assert.rejects(
    runAccountDeletionServerFlow({
      enqueueErasureHeld: async () => {
        throw new Error("queue unavailable");
      },
      deleteStorage: async () => {
        calls.push("delete-storage");
      },
      releaseErasure: async () => {
        calls.push("release-queue");
      },
      revokeSessions: async () => {
        calls.push("revoke-sessions");
      },
      deleteUser: async () => {
        calls.push("delete-user");
      }
    }),
    /queue unavailable/
  );
  assert.deepEqual(calls, []);
});

test("keeps a held queue and user when storage cleanup fails", async () => {
  const calls: string[] = [];

  await assert.rejects(
    runAccountDeletionServerFlow({
      enqueueErasureHeld: async () => {
        calls.push("queue-held");
      },
      deleteStorage: async () => {
        calls.push("delete-storage");
        throw new Error("storage unavailable");
      },
      releaseErasure: async () => {
        calls.push("release-queue");
      },
      revokeSessions: async () => {
        calls.push("revoke-sessions");
      },
      deleteUser: async () => {
        calls.push("delete-user");
      }
    }),
    /storage unavailable/
  );
  assert.deepEqual(calls, ["queue-held", "delete-storage"]);
});
