import * as Crypto from "expo-crypto";
import * as ImageManipulator from "expo-image-manipulator";

import { getSupabaseClient } from "@/lib/supabase";

export const PLANT_PHOTOS_BUCKET = "plant-photos";
const DEFAULT_MAX_PHOTO_EDGE = 1200;
const DEFAULT_COMPRESSION = 0.8;

type PlantPhotoFolder = "timeline";

type PreparePlantPhotoOptions = {
  compress?: number;
  maxEdge?: number;
};

export async function preparePlantPhoto(
  uri: string,
  width?: number,
  height?: number,
  options: PreparePlantPhotoOptions = {}
) {
  const maxEdge = options.maxEdge ?? DEFAULT_MAX_PHOTO_EDGE;
  const longestEdge = Math.max(width ?? 0, height ?? 0);
  const actions =
    longestEdge > maxEdge && width && height
      ? [
          width >= height
            ? { resize: { width: maxEdge } }
            : { resize: { height: maxEdge } }
        ]
      : [];

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: options.compress ?? DEFAULT_COMPRESSION,
    format: ImageManipulator.SaveFormat.JPEG
  });

  return result.uri;
}

export async function uploadPlantPhoto({
  folder,
  photoUri,
  plantId,
  userId
}: {
  folder?: PlantPhotoFolder;
  photoUri: string;
  plantId: string;
  userId: string;
}) {
  const supabase = getSupabaseClient();
  const blob = await uriToBlob(photoUri);
  const fileName = `${Date.now()}-${Crypto.randomUUID()}.jpg`;
  const path = [userId, plantId, folder, fileName].filter(Boolean).join("/");
  const { error } = await supabase.storage
    .from(PLANT_PHOTOS_BUCKET)
    .upload(path, blob, {
      contentType: "image/jpeg",
      upsert: false
    });

  if (error) {
    throw error;
  }

  return {
    path,
    publicUrl: supabase.storage.from(PLANT_PHOTOS_BUCKET).getPublicUrl(path).data
      .publicUrl
  };
}

export async function removePlantPhotoByUrl(photoUrl: string | null | undefined) {
  const path = getPlantPhotoPathFromUrl(photoUrl);

  if (!path) {
    return;
  }

  await getSupabaseClient().storage.from(PLANT_PHOTOS_BUCKET).remove([path]);
}

async function uriToBlob(uri: string) {
  const response = await fetch(uri);

  if (!response.ok) {
    throw new Error("Photo could not be read.");
  }

  return response.blob();
}

function getPlantPhotoPathFromUrl(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  const marker = `/storage/v1/object/public/${PLANT_PHOTOS_BUCKET}/`;
  const markerIndex = url.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  return decodeURIComponent(url.slice(markerIndex + marker.length).split("?")[0]);
}
