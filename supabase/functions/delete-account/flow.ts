export type AccountDeletionServerSteps = {
  deleteStorage: () => Promise<void>;
  deleteUser: () => Promise<void>;
  enqueueErasureHeld: () => Promise<void>;
  releaseErasure: () => Promise<void>;
  revokeSessions: () => Promise<void>;
};

export async function runAccountDeletionServerFlow({
  deleteStorage,
  deleteUser,
  enqueueErasureHeld,
  releaseErasure,
  revokeSessions
}: AccountDeletionServerSteps) {
  // The durable handoff is created before any destructive operation. It stays
  // held until storage cleanup succeeds, so a partial account-deletion failure
  // cannot erase AppsFlyer data for an account that still exists.
  await enqueueErasureHeld();
  await deleteStorage();
  await releaseErasure();
  await revokeSessions();
  await deleteUser();
}
