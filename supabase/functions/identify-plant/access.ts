export type ScanType = "identify" | "diagnose";

type ScanAccess =
  | { allowed: true }
  | {
      allowed: false;
      code: "premium_required";
      message: string;
    };

export function getScanAccess({
  isPremium,
  scanType
}: {
  isPremium: boolean;
  scanType: ScanType;
}): ScanAccess {
  if (isPremium) {
    return { allowed: true };
  }

  return {
    allowed: false,
    code: "premium_required",
    message:
      scanType === "diagnose"
        ? "Disease diagnosis is included with Premium."
        : "Start a trial or subscribe to Premium to identify this plant."
  };
}
