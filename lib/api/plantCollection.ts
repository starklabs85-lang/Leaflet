import * as Crypto from "expo-crypto";

import { generateDefaultCareTasksForPlant } from "@/lib/api/careSchedule";
import { removePlantPhotoByUrl, uploadPlantPhoto } from "@/lib/media/plantPhotos";
import { cancelCareNotificationsForPlant } from "@/lib/notifications/careReminders";
import { getSupabaseClient } from "@/lib/supabase";
import type {
  CollectionResult,
  CollectionSpeciesSummary,
  LightExposure,
  PlantPlacement,
  PlantStatus,
  SavePlantInput,
  SavedPlant,
  UpdatePlantInput
} from "@/types/plantCollection";

type PlantRowWithSpecies = {
  id: string;
  user_id: string;
  species_id: string | null;
  nickname: string | null;
  location: string | null;
  placement: PlantPlacement;
  light_exposure: LightExposure;
  status: PlantStatus;
  photo_url: string | null;
  date_added: string;
  species: {
    id: string;
    common_name: string;
    scientific_name: string | null;
    image_url: string | null;
  } | null;
};

type SpeciesForSave = CollectionSpeciesSummary;

async function getCurrentUser() {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false as const,
      message: "Please sign in again to manage your plants."
    };
  }

  return { ok: true as const, user };
}

function toSavedPlant(row: PlantRowWithSpecies): SavedPlant {
  return {
    id: row.id,
    userId: row.user_id,
    speciesId: row.species_id,
    nickname: row.nickname,
    displayName: row.nickname?.trim() || row.species?.common_name || "Plant",
    location: row.location,
    placement: row.placement,
    lightExposure: row.light_exposure,
    status: row.status,
    photoUrl: row.photo_url,
    dateAdded: row.date_added,
    species: row.species
      ? {
          id: row.species.id,
          commonName: row.species.common_name,
          scientificName: row.species.scientific_name,
          imageUrl: row.species.image_url
        }
      : null
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

export async function fetchSpeciesForSave(
  speciesId: string | undefined
): Promise<CollectionResult<SpeciesForSave>> {
  const normalizedSpeciesId = speciesId?.trim();

  if (!normalizedSpeciesId) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Choose a plant species before saving."
    };
  }

  const { data, error } = await getSupabaseClient()
    .from("species")
    .select("id, common_name, scientific_name, image_url")
    .eq("id", normalizedSpeciesId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: "network_error",
      message: "Plant details could not be loaded. Please try again."
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "not_found",
      message: "That species profile is no longer available."
    };
  }

  return {
    ok: true,
    data: {
      id: data.id,
      commonName: data.common_name,
      scientificName: data.scientific_name,
      imageUrl: data.image_url
    }
  };
}

export async function listUserPlants(): Promise<CollectionResult<SavedPlant[]>> {
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
      "id, user_id, species_id, nickname, location, placement, light_exposure, status, photo_url, date_added, species:species_id(id, common_name, scientific_name, image_url)"
    )
    .eq("user_id", userResult.user.id)
    .order("date_added", { ascending: false })
    .returns<PlantRowWithSpecies[]>();

  if (error) {
    return {
      ok: false,
      code: "network_error",
      message: "Your plant collection could not be loaded."
    };
  }

  return {
    ok: true,
    data: (data ?? []).map(toSavedPlant)
  };
}

export async function fetchUserPlant(
  plantId: string | undefined
): Promise<CollectionResult<SavedPlant>> {
  const normalizedPlantId = plantId?.trim();

  if (!normalizedPlantId) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Plant details are unavailable."
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
      "id, user_id, species_id, nickname, location, placement, light_exposure, status, photo_url, date_added, species:species_id(id, common_name, scientific_name, image_url)"
    )
    .eq("id", normalizedPlantId)
    .eq("user_id", userResult.user.id)
    .maybeSingle()
    .returns<PlantRowWithSpecies | null>();

  if (error) {
    return {
      ok: false,
      code: "network_error",
      message: "Plant details could not be loaded."
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
    data: toSavedPlant(data)
  };
}

export async function createUserPlant(
  input: SavePlantInput
): Promise<CollectionResult<SavedPlant>> {
  const userResult = await getCurrentUser();

  if (!userResult.ok) {
    return {
      ok: false,
      code: "auth_required",
      message: userResult.message
    };
  }

  const nickname = normalizeOptionalText(input.nickname) ?? input.fallbackName;
  const location = normalizeOptionalText(input.location);
  const plantId = Crypto.randomUUID();
  let uploadedPhotoUrl: string | null = null;

  try {
    if (input.photoUri) {
      uploadedPhotoUrl = (
        await uploadPlantPhoto({
          plantId,
          photoUri: input.photoUri,
          userId: userResult.user.id
        })
      ).publicUrl;
    }

    const { data, error } = await getSupabaseClient()
      .from("user_plants")
      .insert({
        id: plantId,
        user_id: userResult.user.id,
        species_id: input.speciesId,
        nickname,
        location,
        placement: input.placement,
        light_exposure: input.lightExposure,
        status: input.status,
        photo_url: uploadedPhotoUrl
      })
      .select(
        "id, user_id, species_id, nickname, location, placement, light_exposure, status, photo_url, date_added, species:species_id(id, common_name, scientific_name, image_url)"
      )
      .single()
      .returns<PlantRowWithSpecies>();

    if (error) {
      await removePlantPhotoByUrl(uploadedPhotoUrl);

      return {
        ok: false,
        code: "network_error",
        message: "Plant could not be saved. Please try again."
      };
    }

    await generateDefaultCareTasksForPlant({
      userPlantId: data.id,
      userId: data.user_id,
      speciesId: data.species_id
    });

    return {
      ok: true,
      data: toSavedPlant(data)
    };
  } catch {
    await removePlantPhotoByUrl(uploadedPhotoUrl);

    return {
      ok: false,
      code: "storage_error",
      message: "Plant photo could not be uploaded. Please try another photo."
    };
  }
}

export async function updateUserPlant(
  input: UpdatePlantInput
): Promise<CollectionResult<SavedPlant>> {
  const userResult = await getCurrentUser();

  if (!userResult.ok) {
    return {
      ok: false,
      code: "auth_required",
      message: userResult.message
    };
  }

  const current = await fetchUserPlant(input.plantId);

  if (!current.ok) {
    return current;
  }

  let uploadedPhotoUrl: string | null = null;

  try {
    if (input.photoUri) {
      uploadedPhotoUrl = (
        await uploadPlantPhoto({
          plantId: input.plantId,
          photoUri: input.photoUri,
          userId: userResult.user.id
        })
      ).publicUrl;
    }

    const { data, error } = await getSupabaseClient()
      .from("user_plants")
      .update({
        nickname: normalizeOptionalText(input.nickname),
        location: normalizeOptionalText(input.location),
        placement: input.placement,
        light_exposure: input.lightExposure,
        status: input.status,
        ...(uploadedPhotoUrl ? { photo_url: uploadedPhotoUrl } : {})
      })
      .eq("id", input.plantId)
      .eq("user_id", userResult.user.id)
      .select(
        "id, user_id, species_id, nickname, location, placement, light_exposure, status, photo_url, date_added, species:species_id(id, common_name, scientific_name, image_url)"
      )
      .maybeSingle()
      .returns<PlantRowWithSpecies | null>();

    if (error) {
      await removePlantPhotoByUrl(uploadedPhotoUrl);

      return {
        ok: false,
        code: "network_error",
        message: "Plant changes could not be saved."
      };
    }

    if (!data) {
      await removePlantPhotoByUrl(uploadedPhotoUrl);

      return {
        ok: false,
        code: "not_found",
        message: "Plant not found."
      };
    }

    if (uploadedPhotoUrl) {
      await removePlantPhotoByUrl(current.data.photoUrl);
    }

    return {
      ok: true,
      data: toSavedPlant(data)
    };
  } catch {
    await removePlantPhotoByUrl(uploadedPhotoUrl);

    return {
      ok: false,
      code: "storage_error",
      message: "Replacement photo could not be uploaded."
    };
  }
}

export async function deleteUserPlant(
  plantId: string
): Promise<CollectionResult<{ plantId: string }>> {
  const current = await fetchUserPlant(plantId);

  if (!current.ok) {
    return current;
  }

  const userResult = await getCurrentUser();

  if (!userResult.ok) {
    return {
      ok: false,
      code: "auth_required",
      message: userResult.message
    };
  }

  const { error } = await getSupabaseClient()
    .from("user_plants")
    .delete()
    .eq("id", plantId)
    .eq("user_id", userResult.user.id);

  if (error) {
    return {
      ok: false,
      code: "network_error",
      message: "Plant could not be removed."
    };
  }

  await cancelPlantRemindersSafely(plantId);
  await removePlantPhotoByUrl(current.data.photoUrl);

  return {
    ok: true,
    data: { plantId }
  };
}

async function cancelPlantRemindersSafely(plantId: string) {
  try {
    await cancelCareNotificationsForPlant(plantId);
  } catch {
    // Local reminder cleanup should not block plant deletion.
  }
}
