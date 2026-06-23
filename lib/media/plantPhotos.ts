import * as Crypto from "expo-crypto";
import * as ImageManipulator from "expo-image-manipulator";

import { getSupabaseClient } from "@/lib/supabase";

export const PLANT_PHOTOS_BUCKET = "plant-photos";
const DEFAULT_MAX_PHOTO_EDGE = 1200;
const DEFAULT_COMPRESSION = 0.8;
const BYTE_READ_COMPRESSION = 0.8;

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
  const bytes = await uriToBytes(photoUri);
  const fileName = `${Date.now()}-${Crypto.randomUUID()}.jpg`;
  const path = [userId, plantId, folder, fileName].filter(Boolean).join("/");
  const { error } = await supabase.storage
    .from(PLANT_PHOTOS_BUCKET)
    .upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: false
  });

  if (error) {
    console.warn("Plant photo upload failed", {
      bucket: PLANT_PHOTOS_BUCKET,
      bytes: bytes.byteLength,
      path,
      message: error.message
    });
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

// React Native's fetch().blob() does not reliably carry file bytes through
// supabase-js Storage uploads (it yields 0-byte files or throws). Per Supabase's
// React Native guidance, upload raw bytes instead. We re-read the image through
// expo-image-manipulator (already a native dependency, so no rebuild) to get
// base64, then decode it to a Uint8Array that supabase-js uploads correctly.
async function uriToBytes(uri: string) {
  const { base64 } = await ImageManipulator.manipulateAsync(uri, [], {
    base64: true,
    compress: BYTE_READ_COMPRESSION,
    format: ImageManipulator.SaveFormat.JPEG
  });

  if (!base64) {
    throw new Error("Photo could not be read.");
  }

  return base64ToUint8Array(base64);
}

const BASE64_LOOKUP = (() => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const table = new Int16Array(256).fill(-1);
  for (let i = 0; i < chars.length; i += 1) {
    table[chars.charCodeAt(i)] = i;
  }
  return table;
})();

function base64ToUint8Array(base64: string) {
  const bytes = new Uint8Array(Math.floor((base64.length * 3) / 4));
  let written = 0;
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < base64.length; i += 1) {
    const value = BASE64_LOOKUP[base64.charCodeAt(i)];

    if (value === -1) {
      continue; // skip padding (=), newlines, and any data-URI prefix noise
    }

    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes[written] = (buffer >> bits) & 0xff;
      written += 1;
    }
  }

  return bytes.subarray(0, written);
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
