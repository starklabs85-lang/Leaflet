export type ManifestParameterType = "boolean" | "number" | "string";

export type AnalyticsManifestEntry = {
  key: string;
  name: string;
  description: string;
  trigger: string;
  semantics: string;
  parameters: Record<string, ManifestParameterType>;
  privacy: "product_analytics";
  firebase: boolean;
  appsFlyer: boolean;
  appsFlyerAlias?: string;
  aliasWhen?: {
    parameter: string;
    equals: boolean | number | string;
  };
  conversionPriority: "none" | "low" | "medium" | "high";
  partnerPostbackEligible: boolean;
};

const s = "string" as const;
const b = "boolean" as const;
const n = "number" as const;

const eventParameters: Record<string, Record<string, ManifestParameterType>> = {
  account_delete_prompt: { source: s },
  account_delete_result: { reason: s, result: s },
  alternate_selected: { alternate_rank: n, selected: b },
  camera_permission_result: { result: s, source: s },
  care_log_result: { reason: s, result: s, type: s },
  care_reminder_toggle: { enabled: b, result: s, source: s },
  deep_link_open: { deferred: b, destination: s, result: s },
  diagnose_result: { reason: s, result: s, stage: s },
  diagnosis_attach_select: { source: s },
  diagnosis_expand: { expanded: b },
  diagnosis_save_result: {
    attached_to_plant: b,
    reason: s,
    result: s,
    target: s
  },
  first_plant_saved: { source: s },
  free_limit_hit: { mode: s, reason: s, stage: s },
  frost_alert_toggle: { enabled: b, result: s },
  growth_photo_add: { reason: s, result: s, source: s },
  identify_result: { has_species_profile: b, reason: s, result: s },
  legal_link_tap: { surface: s, target: s },
  library_permission_result: { result: s, source: s },
  manage_subscription_link: { source: s },
  notification_open: { destination: s, source: s },
  offer_code_redemption: { result: s, source: s },
  onboarding_complete: { method: s },
  paywall_view: { premium_status: s, source: s },
  permanent_account_created: { provider: s },
  photo_capture: { mode: s, reason: s, result: s },
  photo_pick: { mode: s, reason: s, result: s },
  plan_select: { plan: s, source: s },
  plant_delete_prompt: { source: s },
  plant_delete_result: { reason: s, result: s },
  plant_photo_replacement: {
    reason: s,
    result: s,
    source: s,
    surface: s
  },
  plant_save_result: { reason: s, result: s },
  plant_update_result: { changed_photo: b, reason: s, result: s },
  premium_cta: { reason: s, source: s },
  purchase_result: { plan: s, result: s, source: s },
  purchase_start: { plan: s, source: s, trial_eligible: b },
  restore_result: { result: s, source: s },
  restore_start: { source: s },
  returning_sign_in: { provider: s },
  scan_again: { from_step: s, mode: s },
  scan_mode_change: { from_mode: s, source: s, to_mode: s },
  scan_submit: { has_plant_context: b, mode: s },
  sign_in_cancel: { provider: s },
  sign_in_failure: { provider: s, reason: s },
  sign_in_result: { provider: s, result: s },
  sign_in_tap: { provider: s },
  sign_out: { result: s },
  task_interval_update: {
    interval_days: n,
    reason: s,
    result: s,
    task_type: s
  },
  task_toggle: { enabled: b, reason: s, result: s, task_type: s },
  today_task_complete: { reason: s, result: s, source: s, task_type: s },
  ui_tap: { control_name: s, reason: s, source: s, surface: s },
  weather_location_remove: { result: s },
  weather_location_set: { reason: s, result: s, source: s },
  weather_tip_action: { action_kind: s, days: n, result: s }
};

const aliases: Record<
  string,
  Pick<AnalyticsManifestEntry, "appsFlyerAlias" | "aliasWhen">
> = {
  identify_result: {
    appsFlyerAlias: "af_search",
    aliasWhen: { parameter: "result", equals: "success" }
  },
  notification_open: {
    appsFlyerAlias: "af_opened_from_push_notification"
  },
  onboarding_complete: { appsFlyerAlias: "af_tutorial_completion" },
  paywall_view: { appsFlyerAlias: "af_content_view" },
  permanent_account_created: {
    appsFlyerAlias: "af_complete_registration"
  },
  purchase_start: { appsFlyerAlias: "af_initiated_checkout" },
  returning_sign_in: { appsFlyerAlias: "af_login" }
};

const highPriority = new Set([
  "first_plant_saved",
  "identify_result",
  "onboarding_complete",
  "paywall_view",
  "permanent_account_created",
  "purchase_result",
  "purchase_start",
  "returning_sign_in"
]);

const names = [
  "account_delete_prompt",
  "account_delete_result",
  "alternate_selected",
  "camera_permission_result",
  "care_log_result",
  "care_reminder_toggle",
  "diagnose_result",
  "diagnosis_attach_select",
  "diagnosis_expand",
  "diagnosis_save_result",
  "deep_link_open",
  "first_plant_saved",
  "free_limit_hit",
  "frost_alert_toggle",
  "growth_photo_add",
  "identify_result",
  "legal_link_tap",
  "library_permission_result",
  "manage_subscription_link",
  "offer_code_redemption",
  "onboarding_complete",
  "onboarding_skip",
  "notification_open",
  "paywall_view",
  "photo_capture",
  "photo_pick",
  "plan_select",
  "plant_delete_prompt",
  "plant_delete_result",
  "plant_photo_replacement",
  "plant_save_result",
  "plant_update_result",
  "premium_cta",
  "purchase_result",
  "purchase_start",
  "restore_result",
  "restore_start",
  "scan_again",
  "scan_mode_change",
  "scan_submit",
  "sign_in_cancel",
  "sign_in_failure",
  "permanent_account_created",
  "returning_sign_in",
  "sign_in_result",
  "sign_in_tap",
  "sign_out",
  "task_interval_update",
  "task_toggle",
  "today_task_complete",
  "ui_tap",
  "weather_location_remove",
  "weather_location_set",
  "weather_tip_action"
] as const;

export const analyticsManifest: AnalyticsManifestEntry[] = names.map((name) => {
  const readable = name.replaceAll("_", " ");
  const isHighPriority = highPriority.has(name);

  return {
    key: name.toUpperCase(),
    name,
    description: `Records the Fernly ${readable} product milestone.`,
    trigger: `Emitted by the existing ${readable} application flow.`,
    semantics:
      "Result and reason parameters distinguish successful, cancelled, and failed outcomes when applicable.",
    parameters: eventParameters[name] ?? {},
    privacy: "product_analytics",
    firebase: true,
    appsFlyer: true,
    ...aliases[name],
    conversionPriority: isHighPriority ? "high" : "none",
    partnerPostbackEligible: isHighPriority
  };
});

export const analyticsTapManifest = {
  LEGAL_EULA_LINK: "legal_eula_link",
  LEGAL_PRIVACY_LINK: "legal_privacy_link",
  LEGAL_TERMS_LINK: "legal_terms_link",
  PREMIUM_MANAGE_SUBSCRIPTION: "premium_manage_subscription",
  PROFILE_PRIVACY_CHOICES: "profile_privacy_choices",
  SIGN_IN_APPLE_BUTTON: "sign_in_apple_button",
  SIGN_IN_GOOGLE_BUTTON: "sign_in_google_button"
} as const;

export const analyticsUserPropertyManifest = [
  "auth_provider",
  "care_reminders_enabled",
  "onboarding_status",
  "plant_count_bucket",
  "platform",
  "premium_status",
  "weather_location_source"
] as const;
