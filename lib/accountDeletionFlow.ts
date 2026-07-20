export async function deleteAccountThenReset({
  deleteRemoteAccount,
  resetToNewUser
}: {
  deleteRemoteAccount: () => Promise<void>;
  resetToNewUser: () => Promise<void>;
}) {
  await deleteRemoteAccount();
  await resetToNewUser();
}
