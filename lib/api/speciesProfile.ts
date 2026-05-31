import { getSupabaseClient } from "@/lib/supabase";
import type { Json } from "@/types/database";
import type {
  CareDifficulty,
  NormalizedCareProfile,
  SpeciesProfile,
  SpeciesProfileResult,
  ToxicityStatus
} from "@/types/speciesProfile";

const CARE_FIELDS = [
  "light",
  "water",
  "humidity",
  "temperature",
  "soil",
  "feeding"
] as const;

type CareField = (typeof CARE_FIELDS)[number];

type CareProfileRecord = Record<CareField | "difficulty" | "toxicity", unknown>;

function isRecord(value: Json): value is Record<string, Json | undefined> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function textOrFallback(value: unknown) {
  if (typeof value !== "string") {
    return "Not available";
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : "Not available";
}

function normalizeDifficulty(value: unknown): CareDifficulty {
  if (typeof value !== "string") {
    return "unknown";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "easy" || normalized === "moderate" || normalized === "hard") {
    return normalized;
  }

  return "unknown";
}

function getToxicityStatus(toxicity: string): ToxicityStatus {
  const normalized = toxicity.toLowerCase();

  if (toxicity === "Toxicity unknown") {
    return "unknown";
  }

  if (
    /\b(non-toxic|not toxic|safe|pet safe|safe for|not poisonous)\b/.test(
      normalized
    )
  ) {
    return "safe";
  }

  if (
    /\b(toxic|poisonous|poison|harmful|irritant|unsafe|dangerous)\b/.test(
      normalized
    )
  ) {
    return "toxic";
  }

  return "unknown";
}

export function normalizeCareProfile(value: Json): NormalizedCareProfile {
  if (!isRecord(value)) {
    return {
      light: "Not available",
      water: "Not available",
      humidity: "Not available",
      temperature: "Not available",
      soil: "Not available",
      feeding: "Not available",
      difficulty: "unknown",
      toxicity: "Toxicity unknown",
      toxicityStatus: "unknown",
      isMalformed: true,
      missingFields: [...CARE_FIELDS, "difficulty", "toxicity"]
    };
  }

  const profile = value as CareProfileRecord;
  const missingFields = [
    ...CARE_FIELDS.filter((field) => textOrFallback(profile[field]) === "Not available"),
    ...(normalizeDifficulty(profile.difficulty) === "unknown" ? ["difficulty"] : []),
    ...(textOrFallback(profile.toxicity) === "Not available" ? ["toxicity"] : [])
  ];
  const toxicity =
    textOrFallback(profile.toxicity) === "Not available"
      ? "Toxicity unknown"
      : textOrFallback(profile.toxicity);

  return {
    light: textOrFallback(profile.light),
    water: textOrFallback(profile.water),
    humidity: textOrFallback(profile.humidity),
    temperature: textOrFallback(profile.temperature),
    soil: textOrFallback(profile.soil),
    feeding: textOrFallback(profile.feeding),
    difficulty: normalizeDifficulty(profile.difficulty),
    toxicity,
    toxicityStatus: getToxicityStatus(toxicity),
    isMalformed: false,
    missingFields
  };
}

export async function fetchSpeciesProfile(
  speciesId: string | undefined
): Promise<SpeciesProfileResult> {
  const normalizedSpeciesId = speciesId?.trim();

  if (!normalizedSpeciesId) {
    return {
      ok: false,
      code: "missing_species_id",
      message: "Plant information is unavailable because the species id is missing."
    };
  }

  const supabase = getSupabaseClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Please sign in again to view plant information."
    };
  }

  const { data: species, error: speciesError } = await supabase
    .from("species")
    .select("id, common_name, scientific_name, description, image_url, care_profile")
    .eq("id", normalizedSpeciesId)
    .maybeSingle();

  if (speciesError) {
    return {
      ok: false,
      code: "network_error",
      message: "Plant information could not be loaded. Please try again."
    };
  }

  if (!species) {
    return {
      ok: false,
      code: "not_found",
      message: "This plant profile is no longer available."
    };
  }

  const careProfile = normalizeCareProfile(species.care_profile);

  if (careProfile.isMalformed) {
    return {
      ok: false,
      code: "malformed_care_profile",
      message:
        "This plant profile needs a care profile refresh before it can be shown."
    };
  }

  const { data: savedPlant, error: savedPlantError } = await supabase
    .from("user_plants")
    .select("id")
    .eq("user_id", user.id)
    .eq("species_id", normalizedSpeciesId)
    .limit(1)
    .maybeSingle();

  if (savedPlantError) {
    return {
      ok: false,
      code: "network_error",
      message: "Your collection status could not be checked. Please try again."
    };
  }

  const profile: SpeciesProfile = {
    id: species.id,
    commonName: species.common_name,
    scientificName: species.scientific_name,
    description: species.description,
    imageUrl: species.image_url,
    careProfile,
    alreadySaved: Boolean(savedPlant),
    savedPlantId: savedPlant?.id ?? null
  };

  return {
    ok: true,
    profile
  };
}
