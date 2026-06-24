export const LEGAL_LAST_UPDATED = "May 31, 2026";

export const LEGAL_ROUTES = {
  privacy: "/(public)/legal/privacy",
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
      "Fernly stores app data, uploaded plant photos, and subscription-related access records with service providers needed to operate the app. Fernly does not sell personal data to third parties."
  },
  {
    title: "User control and deletion",
    body:
      "You can delete plants from your collection in the app. For account deletion or complete data removal, contact the app owner with the email tied to your Fernly account."
  },
  {
    title: "AI limitations",
    body:
      "Fernly is a production plant-care service, but plant identification and diagnosis output can still be wrong. Diagnosis guidance is informational only. For serious plant, pet, or human safety concerns, consult a qualified expert."
  }
] as const;

export const TERMS_SECTIONS = [
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
