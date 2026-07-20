export type InstallAction =
  | "continue"
  | "initialize"
  | "repair_durable"
  | "reset_reinstall";

export function decideInstallAction({
  durableMarker,
  volatileMarker
}: {
  durableMarker: boolean;
  volatileMarker: boolean;
}): InstallAction {
  if (durableMarker && volatileMarker) {
    return "continue";
  }

  if (durableMarker) {
    return "reset_reinstall";
  }

  return volatileMarker ? "repair_durable" : "initialize";
}

export async function writeInstallMarkersSafely({
  writeVolatile,
  writeDurable
}: {
  writeVolatile: () => Promise<unknown>;
  writeDurable: () => Promise<unknown>;
}) {
  await writeVolatile();
  await writeDurable();
}
