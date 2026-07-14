export const ANALYTICS_EVENTS = {
  ACCOUNT_DELETE_PROMPT: "account_delete_prompt",
  ACCOUNT_DELETE_RESULT: "account_delete_result",
  ALTERNATE_SELECTED: "alternate_selected",
  CAMERA_PERMISSION_RESULT: "camera_permission_result",
  CARE_LOG_RESULT: "care_log_result",
  CARE_REMINDER_TOGGLE: "care_reminder_toggle",
  DIAGNOSE_RESULT: "diagnose_result",
  DIAGNOSIS_ATTACH_SELECT: "diagnosis_attach_select",
  DIAGNOSIS_EXPAND: "diagnosis_expand",
  DIAGNOSIS_SAVE_RESULT: "diagnosis_save_result",
  FREE_LIMIT_HIT: "free_limit_hit",
  FROST_ALERT_TOGGLE: "frost_alert_toggle",
  GROWTH_PHOTO_ADD: "growth_photo_add",
  IDENTIFY_RESULT: "identify_result",
  LEGAL_LINK_TAP: "legal_link_tap",
  LIBRARY_PERMISSION_RESULT: "library_permission_result",
  MANAGE_SUBSCRIPTION_LINK: "manage_subscription_link",
  OFFER_CODE_REDEMPTION: "offer_code_redemption",
  ONBOARDING_COMPLETE: "onboarding_complete",
  ONBOARDING_INTENT_SELECT: "onboarding_intent_select",
  ONBOARDING_SKIP: "onboarding_skip",
  PAYWALL_VIEW: "paywall_view",
  PHOTO_CAPTURE: "photo_capture",
  PHOTO_PICK: "photo_pick",
  PLAN_SELECT: "plan_select",
  PLANT_DELETE_PROMPT: "plant_delete_prompt",
  PLANT_DELETE_RESULT: "plant_delete_result",
  PLANT_PHOTO_REPLACEMENT: "plant_photo_replacement",
  PLANT_SAVE_RESULT: "plant_save_result",
  PLANT_UPDATE_RESULT: "plant_update_result",
  PREMIUM_CTA: "premium_cta",
  PURCHASE_RESULT: "purchase_result",
  PURCHASE_START: "purchase_start",
  RESTORE_RESULT: "restore_result",
  RESTORE_START: "restore_start",
  SCAN_AGAIN: "scan_again",
  SCAN_MODE_CHANGE: "scan_mode_change",
  SCAN_SUBMIT: "scan_submit",
  SIGN_IN_CANCEL: "sign_in_cancel",
  SIGN_IN_FAILURE: "sign_in_failure",
  SIGN_IN_RESULT: "sign_in_result",
  SIGN_IN_TAP: "sign_in_tap",
  SIGN_OUT: "sign_out",
  TASK_INTERVAL_UPDATE: "task_interval_update",
  TASK_TOGGLE: "task_toggle",
  TODAY_TASK_COMPLETE: "today_task_complete",
  UI_TAP: "ui_tap",
  WEATHER_LOCATION_REMOVE: "weather_location_remove",
  WEATHER_LOCATION_SET: "weather_location_set",
  WEATHER_TIP_ACTION: "weather_tip_action"
} as const;

export const ANALYTICS_TAPS = {
  LEGAL_EULA_LINK: "legal_eula_link",
  LEGAL_PRIVACY_LINK: "legal_privacy_link",
  LEGAL_TERMS_LINK: "legal_terms_link",
  PREMIUM_MANAGE_SUBSCRIPTION: "premium_manage_subscription",
  SIGN_IN_APPLE_BUTTON: "sign_in_apple_button",
  SIGN_IN_GOOGLE_BUTTON: "sign_in_google_button"
} as const;

export const ANALYTICS_USER_PROPERTY_KEYS = [
  "auth_provider",
  "care_reminders_enabled",
  "onboarding_status",
  "plant_count_bucket",
  "platform",
  "premium_status",
  "weather_location_source"
] as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type AnalyticsTapName =
  (typeof ANALYTICS_TAPS)[keyof typeof ANALYTICS_TAPS];

export type AnalyticsParamValue =
  | boolean
  | number
  | string
  | null
  | undefined;

export type AnalyticsParams = Record<string, AnalyticsParamValue>;
export type AnalyticsUserPropertyKey =
  (typeof ANALYTICS_USER_PROPERTY_KEYS)[number];
export type AnalyticsUserProperties = Partial<
  Record<AnalyticsUserPropertyKey, AnalyticsParamValue>
>;
export type SanitizedAnalyticsParams = Record<string, boolean | number | string>;
export type SanitizedAnalyticsUserProperties = Record<string, string | null>;

const MAX_EVENT_NAME_LENGTH = 40;
const MAX_PARAM_NAME_LENGTH = 40;
const MAX_PARAM_STRING_LENGTH = 100;
const MAX_USER_PROPERTY_NAME_LENGTH = 24;
const MAX_USER_PROPERTY_VALUE_LENGTH = 36;

const SAFE_PARAM_KEYS = new Set([
  "auth_provider",
  "care_reminders_enabled",
  "control_name",
  "onboarding_status",
  "plant_count_bucket",
  "platform",
  "premium_status",
  "screen_class",
  "screen_name",
  "weather_location_source"
]);

const SENSITIVE_PARAM_KEYS = new Set([
  "address",
  "city",
  "common_name",
  "coordinates",
  "description",
  "display_name",
  "email",
  "error",
  "error_message",
  "exact_location",
  "full_name",
  "image_base64",
  "image_uri",
  "latitude",
  "location",
  "location_label",
  "longitude",
  "message",
  "name",
  "nickname",
  "note",
  "phone",
  "photo",
  "photo_uri",
  "photo_url",
  "plant_name",
  "prevention",
  "prompt",
  "prompt_text",
  "raw_error",
  "scientific_name",
  "text",
  "treatment",
  "url",
  "uri"
]);

export function sanitizeAnalyticsEventName(name: string) {
  return sanitizeAnalyticsName(name, MAX_EVENT_NAME_LENGTH);
}

export function sanitizeAnalyticsParams(
  params: AnalyticsParams | null | undefined
): SanitizedAnalyticsParams {
  if (!params) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(params)
      .map(([key, value]) => {
        const sanitizedKey = sanitizeAnalyticsName(key, MAX_PARAM_NAME_LENGTH);

        if (!sanitizedKey || isSensitiveKey(sanitizedKey)) {
          return null;
        }

        const sanitizedValue = sanitizeParamValue(value, MAX_PARAM_STRING_LENGTH);

        if (sanitizedValue === null) {
          return null;
        }

        return [sanitizedKey, sanitizedValue] as const;
      })
      .filter((entry): entry is readonly [string, boolean | number | string] =>
        Boolean(entry)
      )
  );
}

export function sanitizeAnalyticsUserProperties(
  properties: Record<string, AnalyticsParamValue> | null | undefined
): SanitizedAnalyticsUserProperties {
  if (!properties) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(properties)
      .map(([key, value]) => {
        const sanitizedKey = sanitizeAnalyticsName(
          key,
          MAX_USER_PROPERTY_NAME_LENGTH
        );

        if (!sanitizedKey || isSensitiveKey(sanitizedKey)) {
          return null;
        }

        if (value === null) {
          return [sanitizedKey, null] as const;
        }

        const sanitizedValue = sanitizeParamValue(
          value,
          MAX_USER_PROPERTY_VALUE_LENGTH
        );

        if (sanitizedValue === null) {
          return null;
        }

        return [sanitizedKey, String(sanitizedValue)] as const;
      })
      .filter((entry): entry is readonly [string, string | null] => Boolean(entry))
  );
}

export function toCountBucket(count: number | null | undefined) {
  if (count === null || count === undefined || !Number.isFinite(count)) {
    return "unknown";
  }

  if (count <= 0) {
    return "0";
  }

  if (count === 1) {
    return "1";
  }

  if (count <= 5) {
    return "2_5";
  }

  if (count <= 10) {
    return "6_10";
  }

  return "11_plus";
}

function sanitizeAnalyticsName(name: string, maxLength: number) {
  const sanitized = name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, maxLength);

  if (!sanitized) {
    return "";
  }

  return /^[a-z]/.test(sanitized) ? sanitized : `x_${sanitized}`.slice(0, maxLength);
}

function sanitizeParamValue(value: AnalyticsParamValue, maxLength: number) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const trimmed = value.trim();

  if (!trimmed || looksLikeDirectIdentifier(trimmed)) {
    return null;
  }

  return trimmed
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, maxLength);
}

function isSensitiveKey(key: string) {
  if (SAFE_PARAM_KEYS.has(key)) {
    return false;
  }

  return (
    SENSITIVE_PARAM_KEYS.has(key) ||
    key.endsWith("_email") ||
    key.endsWith("_message") ||
    key.endsWith("_name") ||
    key.endsWith("_note") ||
    key.endsWith("_prompt") ||
    key.endsWith("_text") ||
    key.endsWith("_uri") ||
    key.endsWith("_url")
  );
}

function looksLikeDirectIdentifier(value: string) {
  return (
    value.includes("@") ||
    /^https?:\/\//i.test(value) ||
    /^file:\/\//i.test(value) ||
    /^data:/i.test(value)
  );
}
