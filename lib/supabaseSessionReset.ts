export async function resetSupabaseSession({
  signOut,
  removePersistedSession,
  disposeClient
}: {
  signOut: () => Promise<unknown>;
  removePersistedSession: () => Promise<unknown>;
  disposeClient: () => Promise<unknown>;
}) {
  await signOut().catch(() => undefined);

  try {
    await removePersistedSession();
  } finally {
    await disposeClient();
  }
}
