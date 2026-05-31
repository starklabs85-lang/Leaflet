import { removePlantPhotoByUrl, uploadPlantPhoto } from "@/lib/media/plantPhotos";
import { getSupabaseClient } from "@/lib/supabase";
import type { Database } from "@/types/database";
import type {
  GrowthPhoto,
  GrowthTimelineResult
} from "@/types/growthTimeline";

type GrowthPhotoRow = Pick<
  Database["public"]["Tables"]["care_logs"]["Row"],
  | "id"
  | "user_plant_id"
  | "user_id"
  | "note"
  | "photo_url"
  | "logged_at"
  | "created_at"
>;

async function getCurrentUser() {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false as const,
      message: "Please sign in again to manage growth photos."
    };
  }

  return { ok: true as const, user };
}

function normalizeId(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function toGrowthPhoto(row: GrowthPhotoRow): GrowthPhoto | null {
  if (!row.photo_url) {
    return null;
  }

  return {
    id: row.id,
    userPlantId: row.user_plant_id,
    userId: row.user_id,
    note: row.note,
    photoUrl: row.photo_url,
    loggedAt: row.logged_at,
    createdAt: row.created_at
  };
}

export async function listGrowthPhotosForPlant(
  userPlantId: string | undefined,
  limit = 30
): Promise<GrowthTimelineResult<GrowthPhoto[]>> {
  const normalizedPlantId = normalizeId(userPlantId);

  if (!normalizedPlantId) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Growth timeline is unavailable for this plant."
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
    .from("care_logs")
    .select("id, user_plant_id, user_id, note, photo_url, logged_at, created_at")
    .eq("user_plant_id", normalizedPlantId)
    .eq("user_id", userResult.user.id)
    .eq("task_type", "growth_photo")
    .not("photo_url", "is", null)
    .order("logged_at", { ascending: true })
    .limit(limit)
    .returns<GrowthPhotoRow[]>();

  if (error) {
    return {
      ok: false,
      code: "network_error",
      message: "Growth timeline could not be loaded."
    };
  }

  return {
    ok: true,
    data: (data ?? []).map(toGrowthPhoto).filter(Boolean) as GrowthPhoto[]
  };
}

export async function addGrowthPhoto({
  note,
  photoUri,
  userPlantId
}: {
  note?: string | null;
  photoUri: string;
  userPlantId: string | undefined;
}): Promise<GrowthTimelineResult<GrowthPhoto>> {
  const normalizedPlantId = normalizeId(userPlantId);
  const normalizedPhotoUri = normalizeId(photoUri);

  if (!normalizedPlantId || !normalizedPhotoUri) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Choose a growth photo before saving."
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

  const supabase = getSupabaseClient();
  const { data: plant, error: plantError } = await supabase
    .from("user_plants")
    .select("id, user_id")
    .eq("id", normalizedPlantId)
    .eq("user_id", userResult.user.id)
    .maybeSingle()
    .returns<{ id: string; user_id: string } | null>();

  if (plantError) {
    return {
      ok: false,
      code: "network_error",
      message: "Plant ownership could not be verified."
    };
  }

  if (!plant) {
    return {
      ok: false,
      code: "not_found",
      message: "Plant not found."
    };
  }

  let uploadedPhotoUrl: string | null = null;

  try {
    uploadedPhotoUrl = (
      await uploadPlantPhoto({
        folder: "timeline",
        photoUri: normalizedPhotoUri,
        plantId: plant.id,
        userId: userResult.user.id
      })
    ).publicUrl;
  } catch {
    return {
      ok: false,
      code: "storage_error",
      message: "Growth photo could not be uploaded. Please try another photo."
    };
  }

  const { data, error } = await supabase
    .from("care_logs")
    .insert({
      user_plant_id: plant.id,
      user_id: userResult.user.id,
      task_type: "growth_photo",
      note: normalizeOptionalText(note),
      photo_url: uploadedPhotoUrl
    })
    .select("id, user_plant_id, user_id, note, photo_url, logged_at, created_at")
    .single()
    .returns<GrowthPhotoRow>();

  if (error) {
    await removePlantPhotoByUrl(uploadedPhotoUrl);

    return {
      ok: false,
      code: "network_error",
      message: "Growth photo could not be saved."
    };
  }

  const growthPhoto = toGrowthPhoto(data);

  if (!growthPhoto) {
    await removePlantPhotoByUrl(uploadedPhotoUrl);

    return {
      ok: false,
      code: "network_error",
      message: "Growth photo could not be saved."
    };
  }

  return {
    ok: true,
    data: growthPhoto
  };
}
