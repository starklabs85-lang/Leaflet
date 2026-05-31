export type CareDifficulty = "easy" | "moderate" | "hard" | "unknown";

export type ToxicityStatus = "safe" | "toxic" | "unknown";

export type NormalizedCareProfile = {
  light: string;
  water: string;
  humidity: string;
  temperature: string;
  soil: string;
  feeding: string;
  difficulty: CareDifficulty;
  toxicity: string;
  toxicityStatus: ToxicityStatus;
  isMalformed: boolean;
  missingFields: string[];
};

export type SpeciesProfile = {
  id: string;
  commonName: string;
  scientificName: string | null;
  description: string | null;
  imageUrl: string | null;
  careProfile: NormalizedCareProfile;
  alreadySaved: boolean;
  savedPlantId: string | null;
};

export type SpeciesProfileErrorCode =
  | "missing_species_id"
  | "network_error"
  | "not_found"
  | "malformed_care_profile"
  | "unauthorized";

export type SpeciesProfileResult =
  | {
      ok: true;
      profile: SpeciesProfile;
    }
  | {
      ok: false;
      code: SpeciesProfileErrorCode;
      message: string;
    };
