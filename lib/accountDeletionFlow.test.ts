import assert from "node:assert/strict";
import test from "node:test";

import { deleteAccountThenReset } from "./accountDeletionFlow.js";

test("resets local state only after backend account deletion succeeds", async () => {
  const calls: string[] = [];

  await deleteAccountThenReset({
    deleteRemoteAccount: async () => {
      calls.push("delete_remote");
    },
    resetToNewUser: async () => {
      calls.push("reset_local");
    }
  });

  assert.deepEqual(calls, ["delete_remote", "reset_local"]);
});

test("keeps the current session and local data when backend deletion fails", async () => {
  const calls: string[] = [];

  await assert.rejects(
    deleteAccountThenReset({
      deleteRemoteAccount: async () => {
        calls.push("delete_remote");
        throw new Error("delete failed");
      },
      resetToNewUser: async () => {
        calls.push("reset_local");
      }
    }),
    /delete failed/
  );

  assert.deepEqual(calls, ["delete_remote"]);
});
