import type { Database } from "@/types/database";

export type DiagnosisCategory =
  | "disease"
  | "pest"
  | "nutrient_deficiency"
  | "environmental"
  | "unknown";

export type DiagnosisSeverity = "mild" | "moderate" | "severe";

export type DiagnosisCondition = {
  name: string;
  confidence: number;
  category: DiagnosisCategory;
};

export type PlantDiagnosisResult = {
  condition: DiagnosisCondition;
  cause: string;
  treatment: string[];
  prevention: string;
  severity: DiagnosisSeverity;
  followUpDays: number;
  isHealthy: boolean;
};

export type DiagnosisDraft = {
  id: string;
  photoUri: string;
  result: PlantDiagnosisResult;
  sourcePlantId: string | null;
  sourcePlantName: string | null;
};

export type SavedDiagnosis = {
  id: string;
  userId: string;
  userPlantId: string | null;
  conditionName: string;
  category: DiagnosisCategory;
  confidence: number | null;
  severity: DiagnosisSeverity;
  isHealthy: boolean;
  cause: string | null;
  treatment: string | null;
  treatmentSteps: string[];
  prevention: string | null;
  followUpDays: number;
  followUpDate: string | null;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DiagnosisErrorCode =
  | "auth_required"
  | "empty_response"
  | "function_error"
  | "invalid_input"
  | "network_error"
  | "not_found"
  | "validation_failed";

export type DiagnosisServiceResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      code: DiagnosisErrorCode;
      message: string;
    };

export type SaveDiagnosisInput = {
  result: PlantDiagnosisResult;
  userPlantId: string | null;
  photoUrl?: string | null;
};

export type DiagnosisRow = Database["public"]["Tables"]["diagnoses"]["Row"];

export const DIAGNOSIS_ADVISORY =
  "This diagnosis is AI-generated and advisory. For serious plant health concerns, consult a local nursery or extension service.";

