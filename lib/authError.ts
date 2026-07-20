export function formatAuthError(error: unknown) {
  const code = getAuthErrorCode(error);
  const message =
    error instanceof Error ? error.message : "Sign-in failed. Please try again.";
  const normalized = message.toLowerCase();

  if (code === "DEVELOPER_ERROR" || code === "10") {
    return "Sign-in failed (DEVELOPER_ERROR): the app's package name and signing SHA-1 are not registered on an Android OAuth client in Google Cloud.";
  }

  if (
    normalized.includes("auth session missing") ||
    normalized.includes("session missing")
  ) {
    return "Your sign-in session expired. Please try again.";
  }

  if (normalized.includes("invalid login")) {
    return "Email or password is incorrect. Check your details and try again.";
  }

  if (normalized.includes("email not confirmed") || normalized.includes("unconfirmed")) {
    return "Please confirm your email address before signing in.";
  }

  if (
    normalized.includes("already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("user already")
  ) {
    return "An account already exists for this email. Try signing in instead.";
  }

  if (
    normalized.includes("weak password") ||
    normalized.includes("password should be") ||
    normalized.includes("password must") ||
    normalized.includes("at least 6")
  ) {
    return "Use a stronger password. It must be at least 6 characters.";
  }

  if (normalized.includes("signup") && normalized.includes("disabled")) {
    return "New account creation is currently disabled for this project.";
  }

  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Too many sign-in attempts. Wait a moment and try again.";
  }

  if (
    normalized.includes("network") ||
    normalized.includes("fetch") ||
    normalized.includes("timeout")
  ) {
    return "Fernly could not reach the sign-in service. Check your connection and try again.";
  }

  return code ? `${message} (code: ${code})` : message;
}

function getAuthErrorCode(error: unknown) {
  if (typeof error !== "object" || !error || !("code" in error)) {
    return null;
  }

  const value = (error as { code: unknown }).code;

  if (value === undefined || value === null) {
    return null;
  }

  const code = String(value).trim();
  return code || null;
}
