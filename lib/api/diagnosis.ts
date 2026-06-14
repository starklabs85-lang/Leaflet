import { identifyPlant } from "@/lib/api/identifyPlant";
import { addDaysToLocalDate } from "@/lib/api/careSchedule";
import { syncCareTaskReminder } from "@/lib/notifications/careReminders";
import { getSupabaseClient } from "@/lib/supabase";
import type { Json } from "@/types/database";
import type {
  DiagnosisRow,
  DiagnosisServiceResult,
  PlantDiagnosisResult,
  SaveDiagnosisInput,
  SavedDiagnosis
} from "@/types/diagnosis";
import type { DiagnosisSpeciesContext } from "@/types/identifyPlant";
import type { PlantStatus } from "@/types/plantCollection";

type PlantContextRow = {
  id: string;
  user_id: string;
  nickname: string | null;
  species: {
    common_name: string;
    scientific_name: string | null;
  } | null;
};

type PlantAttachRow = {
  id: string;
  user_id: string;
  status: PlantStatus;
};

async function getCurrentUser() {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false as const,
      message: "Please sign in again to manage diagnoses."
    };
  }

  return { ok: true as const, user };
}

function normalizeId(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function normalizeFollowUpDays(value: number) {
  if (!Number.isFinite(value) || value < 1) {
    return 7;
  }

  return Math.min(60, Math.round(value));
}

function treatmentToText(steps: string[]) {
  return steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
}

function parseTreatmentSteps(value: Json) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return [];
}

function toSavedDiagnosis(row: DiagnosisRow): SavedDiagnosis {
  return {
    id: row.id,
    userId: row.user_id,
    userPlantId: row.user_plant_id,
    conditionName: row.condition_name,
    category: row.category,
    confidence: row.confidence,
    severity: row.severity,
    isHealthy: row.is_healthy,
    cause: row.cause,
    treatment: row.treatment,
    treatmentSteps: parseTreatmentSteps(row.treatment_steps),
    prevention: row.prevention,
    followUpDays: row.follow_up_days,
    followUpDate: row.follow_up_date,
    photoUrl: row.photo_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function statusForDiagnosis(result: PlantDiagnosisResult): PlantStatus | null {
  if (result.isHealthy) {
    return null;
  }

  return result.severity === "mild" ? "needs_attention" : "sick";
}

async function rollbackDiagnosis(diagnosisId: string, userId: string) {
  await getSupabaseClient()
    .from("diagnoses")
    .delete()
    .eq("id", diagnosisId)
    .eq("user_id", userId);
}

async function rollbackPlantStatus({
  plantId,
  status,
  userId
}: {
  plantId: string;
  status: PlantStatus;
  userId: string;
}) {
  await getSupabaseClient()
    .from("user_plants")
    .update({ status })
    .eq("id", plantId)
    .eq("user_id", userId);
}

export async function diagnosePlantPhoto({
  clientRequestId,
  imageBase64,
  speciesContext
}: {
  clientRequestId?: string;
  imageBase64: string;
  speciesContext?: DiagnosisSpeciesContext | null;
}): Promise<
  DiagnosisServiceResult<{
    result: PlantDiagnosisResult;
    cacheHit: boolean;
    clientRequestId: string | null;
  }>
> {
  const response = await identifyPlant({
    imageBase64,
    imageMimeType: "image/jpeg",
    scanType: "diagnose",
    speciesContext: speciesContext ?? null,
    clientRequestId
  });

  if (!response.ok) {
    return {
      ok: false,
      code:
        response.error.code === "validation_failed"
          ? "validation_failed"
          : response.error.code === "empty_response"
            ? "empty_response"
            : response.error.code === "free_limit_reached"
              ? "free_limit_reached"
              : "function_error",
      message: response.error.message
    };
  }

  if (response.data.scanType !== "diagnose") {
    return {
      ok: false,
      code: "validation_failed",
      message: "Diagnosis result could not be read."
    };
  }

  return {
    ok: true,
    data: {
      result: response.data.result,
      cacheHit: response.data.cacheHit,
      clientRequestId: response.data.clientRequestId
    }
  };
}

export async function fetchDiagnosisSpeciesContext(
  userPlantId: string | null | undefined
): Promise<DiagnosisServiceResult<DiagnosisSpeciesContext | null>> {
  const normalizedPlantId = normalizeId(userPlantId);

  if (!normalizedPlantId) {
    return {
      ok: true,
      data: null
    };
  }

  const userResult = await getCurrentUser();

  if (!userResult.ok) {
    return {
      ok: false,
      code: "auth_required",
      message: userResult.message
    };
  }

  const { data, error } = await getSupabaseClient()
    .from("user_plants")
    .select(
      "id, user_id, nickname, species:species_id(common_name, scientific_name)"
    )
    .eq("id", normalizedPlantId)
    .eq("user_id", userResult.user.id)
    .maybeSingle()
    .returns<PlantContextRow | null>();

  if (error) {
    return {
      ok: false,
      code: "network_error",
      message: "Plant context could not be loaded."
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "not_found",
      message: "Plant not found."
    };
  }

  return {
    ok: true,
    data: {
      userPlantId: data.id,
      plantName: data.nickname ?? data.species?.common_name ?? "Tracked plant",
      commonName: data.species?.common_name ?? null,
      scientificName: data.species?.scientific_name ?? null
    }
  };
}

export async function saveDiagnosis(
  input: SaveDiagnosisInput
): Promise<DiagnosisServiceResult<SavedDiagnosis>> {
  const userResult = await getCurrentUser();

  if (!userResult.ok) {
    return {
      ok: false,
      code: "auth_required",
      message: userResult.message
    };
  }

  const normalizedPlantId = normalizeId(input.userPlantId);
  const followUpDays = normalizeFollowUpDays(input.result.followUpDays);
  const followUpDate = addDaysToLocalDate(followUpDays);
  const status = statusForDiagnosis(input.result);
  const supabase = getSupabaseClient();
  let attachedPlant: PlantAttachRow | null = null;

  if (normalizedPlantId) {
    const { data: plantData, error: plantError } = await supabase
      .from("user_plants")
      .select("id, user_id, status")
      .eq("id", normalizedPlantId)
      .eq("user_id", userResult.user.id)
      .maybeSingle()
      .returns<PlantAttachRow | null>();

    if (plantError) {
      return {
        ok: false,
        code: "network_error",
        message: "Plant could not be checked before saving. Your result is still here to retry."
      };
    }

    if (!plantData) {
      return {
        ok: false,
        code: "not_found",
        message: "Plant not found. Your result is still here to retry."
      };
    }

    attachedPlant = plantData;
  }

  const { data, error } = await supabase
    .from("diagnoses")
    .insert({
      user_id: userResult.user.id,
      user_plant_id: normalizedPlantId,
      condition_name: input.result.condition.name,
      category: input.result.condition.category,
      confidence: input.result.condition.confidence,
      severity: input.result.severity,
      is_healthy: input.result.isHealthy,
      cause: input.result.cause,
      treatment: treatmentToText(input.result.treatment),
      treatment_steps: input.result.treatment,
      prevention: input.result.prevention,
      follow_up_days: followUpDays,
      follow_up_date: followUpDate,
      photo_url: input.photoUrl ?? null
    })
    .select(
      "id, user_plant_id, user_id, condition_name, category, confidence, severity, is_healthy, cause, treatment, treatment_steps, prevention, follow_up_days, follow_up_date, photo_url, created_at, updated_at"
    )
    .single()
    .returns<DiagnosisRow>();

  if (error) {
    return {
      ok: false,
      code: "network_error",
      message: "Diagnosis could not be saved. Your result is still here to retry."
    };
  }

  if (attachedPlant && status) {
    const { error: updateError } = await supabase
      .from("user_plants")
      .update({ status })
      .eq("id", attachedPlant.id)
      .eq("user_id", userResult.user.id);

    if (updateError) {
      await rollbackDiagnosis(data.id, userResult.user.id);

      return {
        ok: false,
        code: "network_error",
        message:
          "Diagnosis could not be attached to the plant. Your result is still here to retry."
      };
    }
  }

  if (attachedPlant) {
    const { data: taskData, error: taskError } = await supabase
      .from("care_tasks")
      .insert({
        user_id: userResult.user.id,
        user_plant_id: attachedPlant.id,
        type: "check_diagnosis",
        interval_days: followUpDays,
        next_due_date: followUpDate,
        is_active: true
      })
      .select("id")
      .single()
      .returns<{ id: string }>();

    if (taskError) {
      await rollbackDiagnosis(data.id, userResult.user.id);

      if (status) {
        await rollbackPlantStatus({
          plantId: attachedPlant.id,
          status: attachedPlant.status,
          userId: userResult.user.id
        });
      }

      return {
        ok: false,
        code: "network_error",
        message:
          "Follow-up reminder could not be created. Your result is still here to retry."
      };
    }

    if (taskData?.id) {
      await syncTaskReminderSafely(taskData.id);
    }
  }

  return {
    ok: true,
    data: toSavedDiagnosis(data)
  };
}

async function syncTaskReminderSafely(taskId: string) {
  try {
    await syncCareTaskReminder(taskId);
  } catch {
    // Local reminder sync should not fail a saved diagnosis.
  }
}

export async function listDiagnosesForPlant(
  userPlantId: string | undefined
): Promise<DiagnosisServiceResult<SavedDiagnosis[]>> {
  const normalizedPlantId = normalizeId(userPlantId);

  if (!normalizedPlantId) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Diagnosis history is unavailable for this plant."
    };
  }

  const userResult = await getCurrentUser();

  if (!userResult.ok) {
    return {
      ok: false,
      code: "auth_required",
      message: userResult.message
    };
  }

  const { data, error } = await getSupabaseClient()
    .from("diagnoses")
    .select(
      "id, user_plant_id, user_id, condition_name, category, confidence, severity, is_healthy, cause, treatment, treatment_steps, prevention, follow_up_days, follow_up_date, photo_url, created_at, updated_at"
    )
    .eq("user_plant_id", normalizedPlantId)
    .eq("user_id", userResult.user.id)
    .order("created_at", { ascending: false })
    .returns<DiagnosisRow[]>();

  if (error) {
    return {
      ok: false,
      code: "network_error",
      message: "Diagnosis history could not be loaded."
    };
  }

  return {
    ok: true,
    data: (data ?? []).map(toSavedDiagnosis)
  };
}
