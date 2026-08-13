export const LEGAL_LAST_UPDATED = "August 13, 2026";
export const STANDARD_EULA_URL =
  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

export const LEGAL_ROUTES = {
  privacy: "/(public)/legal/privacy",
  eula: "/(public)/legal/eula",
  terms: "/(public)/legal/terms"
} as const;

export const PRIVACY_POLICY_SECTIONS = [
  {
    title: "Data Fernly collects",
    body:
      "Fernly collects account identifiers, plant photos you choose to scan or save, plant collection details, care tasks, care logs, diagnosis results, and local preferences such as onboarding and reminder settings."
  },
  {
    title: "Photo and AI processing",
    body:
      "Photos submitted for identification or diagnosis are uploaded for automated plant analysis and used to produce plant identification, care, or diagnosis guidance. Do not upload photos that contain people, private documents, or sensitive surroundings."
  },
  {
    title: "Storage and service providers",
    body:
      "Fernly stores app data and uploaded plant photos with Supabase, processes subscription access and lifecycle events with RevenueCat, and uses Firebase and AppsFlyer for optional measurement and attribution when you allow it. These providers process data only to operate, secure, measure, and improve Fernly. Fernly does not sell personal data."
  },
  {
    title: "Measurement and attribution",
    body:
      "With your measurement consent, Fernly uses Firebase/Google Analytics and AppsFlyer to understand screen views, product milestones, campaign attribution, and subscription funnel outcomes. iOS may then ask for App Tracking Transparency permission. If Apple permission is authorized, Fernly may use the advertising identifier (IDFA), a pseudonymous Supabase user ID, an AppsFlyer installation ID, Apple’s vendor identifier (IDFV), IP-derived attribution signals, premium status, sign-in provider, onboarding status, platform, reminder status, weather-location source, and coarse count buckets for install and conversion measurement. If Apple permission is denied, Fernly disables IDFA, user-level AppsFlyer identity, partner sharing, RevenueCat attribution sharing, and AppsFlyer uninstall-token registration, while allowing only privacy-preserving anonymous or aggregate attribution. Fernly never sends emails, names, photo contents or URIs, plant or species names, exact location, prompts, URLs, or raw errors to analytics."
  },
  {
    title: "Privacy choices and partner sharing",
    body:
      "Fernly presents its optional measurement choice before Firebase or AppsFlyer starts. Your choice is stored on this installation with the policy version and decision time; rejected events are not buffered or replayed. Apple separately controls tracking permission in iOS Settings. You can change or withdraw Fernly’s measurement choice at any time from Profile > Privacy choices. Withdrawal stops future Firebase and AppsFlyer collection, partner sharing, subscription attribution synchronization, and uninstall measurement. Advertising partners receive only consent-permitted install and selected conversion or subscription lifecycle postbacks; Fernly does not create personalized-ad audiences or generate an IAB TCF consent string."
  },
  {
    title: "Subscription measurement",
    body:
      "RevenueCat is Fernly’s source for subscription lifecycle and gross subscription revenue reporting to AppsFlyer, including trials, initial subscriptions, renewals, cancellations, billing issues, expirations, product changes, and refunds. Client-side purchase events contain funnel status only and do not include revenue values."
  },
  {
    title: "Retention",
    body:
      "Fernly retains operational account data while your account is active and as needed for service, security, tax, and legal obligations. Analytics and attribution data follow the configured Firebase, AppsFlyer, RevenueCat, and export retention periods. Where licensed, raw attribution exports are scheduled for deletion after 400 days and aggregate campaign and cost data after 25 months. Final retention settings are subject to provider availability and legal review."
  },
  {
    title: "User control and deletion",
    body:
      "You can delete plants from your collection and permanently delete your account from Profile. Before the Supabase account is removed, Fernly durably queues an AppsFlyer erasure request using pseudonymous provider identifiers. Provider delivery and completion continue asynchronously, are retried, and the stored provider identifiers are erased after completion. Deleting a Fernly account does not cancel an App Store subscription."
  },
  {
    title: "AI limitations",
    body:
      "Fernly is a production plant-care service, but plant identification and diagnosis output can still be wrong. Diagnosis guidance is informational only. For serious plant, pet, or human safety concerns, consult a qualified expert."
  }
] as const;

export const STANDARD_EULA_SECTIONS = [
  {
    title: "Standard EULA",
    body:
      "Fernly is licensed under Apple's Standard Licensed Application End User License Agreement unless Fernly provides a separate signed agreement."
  },
  {
    title: "Subscriptions",
    body:
      "Deleting your Fernly account does not cancel an App Store subscription. Manage or cancel subscriptions separately in your Apple account settings."
  }
] as const;

export const TERMS_SECTIONS = [
  {
    title: "Provider and brand",
    body:
      "Fernly is provided by Aditi Somani and operates under the Stark Labs brand. References to Fernly, we, or us in these terms mean Aditi Somani as the legal provider of the app."
  },
  {
    title: "Using Fernly",
    body:
      "Fernly helps you identify houseplants, save a plant collection, track care, and review informational plant-health guidance. You are responsible for checking results before acting on them."
  },
  {
    title: "Accounts and access",
    body:
      "You must use a supported sign-in method. Keep your account secure and only upload photos and plant records that you have the right to use."
  },
  {
    title: "AI and diagnosis disclaimer",
    body:
      "Fernly's AI results are not guaranteed to be accurate. Diagnosis output is educational plant-care guidance, not professional agricultural, veterinary, medical, or safety advice."
  },
  {
    title: "Acceptable use",
    body:
      "Do not upload illegal, harmful, private, or non-plant content. Do not attempt to bypass rate limits, access another user's data, or interfere with Fernly's service."
  },
  {
    title: "Service changes",
    body:
      "Features, data model, and availability may change as Fernly improves. Fernly is provided as-is as a plant-care information service."
  }
] as const;
