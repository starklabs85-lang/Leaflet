import type { PlantDiagnosisResult } from "@/types/diagnosis";

export type IdentifyPlantScanType = "identify";
export type DiagnosePlantScanType = "diagnose";
export type ScanType = IdentifyPlantScanType | DiagnosePlantScanType;

export type PlantCareProfile = {
  light: string;
  water: string;
  humidity: string;
  temperature: string;
  soil: string;
  feeding: string;
  difficulty: "easy" | "moderate" | "hard";
  toxicity: string;
};

export type PlantIdentificationCandidate = {
  commonName: string;
  scientificName: string;
  confidence: number;
  description?: string;
};

export type PlantIdentificationResult = {
  isPlant: true;
  primary: PlantIdentificationCandidate & {
    description: string;
  };
  alternates: PlantIdentificationCandidate[];
  careProfile: PlantCareProfile;
  speciesId: string | null;
};

export type NotAPlantResult = {
  isPlant: false;
  message: string;
};

export type IdentifyPlantResult = PlantIdentificationResult | NotAPlantResult;

export type DiagnosisSpeciesContext = {
  userPlantId?: string | null;
  plantName?: string | null;
  commonName?: string | null;
  scientificName?: string | null;
};

export type IdentifyPlantRequest = {
  imageBase64: string;
  scanType: "identify";
  imageMimeType: "image/jpeg";
  clientRequestId?: string;
};

export type DiagnosePlantRequest = {
  imageBase64: string;
  scanType: "diagnose";
  imageMimeType: "image/jpeg";
  clientRequestId?: string;
  speciesContext?: DiagnosisSpeciesContext | null;
};

export type IdentifyPlantSuccessResponse = {
  ok: true;
  data: {
    status: "identified" | "not_a_plant";
    scanType: "identify";
    cacheHit: boolean;
    result: IdentifyPlantResult;
    userId: string;
    clientRequestId: string | null;
  };
};

export type DiagnosePlantSuccessResponse = {
  ok: true;
  data: {
    status: "diagnosed" | "healthy";
    scanType: "diagnose";
    cacheHit: boolean;
    result: PlantDiagnosisResult;
    userId: string;
    clientRequestId: string | null;
  };
};

export type IdentifyPlantErrorResponse = {
  ok: false;
  error: {
    code:
      | "function_error"
      | "empty_response"
      | "free_limit_reached"
      | "invalid_json"
      | "invalid_request"
      | "missing_openai_key"
      | "method_not_allowed"
      | "openai_unavailable"
      | "premium_required"
      | "rate_limited"
      | "unauthorized"
      | "validation_failed";
    message: string;
    retryAfterSeconds?: number;
    scanType?: "identify" | "diagnose";
    limit?: number;
  };
};

export type IdentifyPlantResponse =
  | IdentifyPlantSuccessResponse
  | DiagnosePlantSuccessResponse
  | IdentifyPlantErrorResponse;

export type IdentifyPlantFunctionRequest =
  | IdentifyPlantRequest
  | DiagnosePlantRequest;
