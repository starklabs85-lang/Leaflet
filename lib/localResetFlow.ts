type ResetStep = () => Promise<unknown>;

export async function runLocalResetSteps({
  essential,
  cleanup
}: {
  essential: ResetStep[];
  cleanup: ResetStep[];
}) {
  for (const step of essential) {
    await step();
  }

  await Promise.allSettled(cleanup.map((step) => step()));
}
