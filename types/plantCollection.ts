export type PlantStatus = "healthy" | "needs_attention" | "sick";

// Structured environment signals read by the weather tip engine.
// "unknown" is treated as indoor (the safe default).
export type PlantPlacement = "indoor" | "outdoor" | "balcony" | "unknown";

export type LightExposure = "low" | "medium" | "bright" | "unknown";

export type CollectionSpeciesSummary = {
  id: string;
  commonName: string;
  scientificName: string | null;
  imageUrl: string | null;
};

export type SavedPlant = {
  id: string;
  userId: string;
  speciesId: string | null;
  nickname: string | null;
  displayName: string;
  location: string | null;
  placement: PlantPlacement;
  lightExposure: LightExposure;
  status: PlantStatus;
  photoUrl: string | null;
  dateAdded: string;
  species: CollectionSpeciesSummary | null;
};

export type SavePlantInput = {
  speciesId: string;
  nickname: string;
  fallbackName: string;
  location: string | null;
  placement: PlantPlacement;
  lightExposure: LightExposure;
  status: PlantStatus;
  photoUri?: string | null;
};

export type UpdatePlantInput = {
  plantId: string;
  nickname: string | null;
  location: string | null;
  placement: PlantPlacement;
  lightExposure: LightExposure;
  status: PlantStatus;
  photoUri?: string | null;
};

export type CollectionErrorCode =
  | "auth_required"
  | "not_found"
  | "network_error"
  | "storage_error"
  | "invalid_input";

export type CollectionResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      code: CollectionErrorCode;
      message: string;
    };
