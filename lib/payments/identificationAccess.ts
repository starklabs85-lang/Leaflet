export type IdentificationAccess =
  | { allowed: true; remaining: null }
  | { allowed: false; remaining: 0; message: string };

export function getIdentificationAccess(
  isPremium: boolean
): IdentificationAccess {
  if (isPremium) {
    return { allowed: true, remaining: null };
  }

  return {
    allowed: false,
    remaining: 0,
    message: "Start a trial or subscribe to Premium to identify this plant."
  };
}
