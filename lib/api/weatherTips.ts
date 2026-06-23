import { getLocalDateString } from "@/lib/api/careSchedule";
import { secureStorageAdapter } from "@/lib/secure-storage";
import { getSupabaseClient } from "@/lib/supabase";
import type { StoredUserLocation } from "@/lib/location/userLocation";
import type { WeatherTipsResponse } from "@/types/weather";

export type WeatherTipsResult =
  | { ok: true; data: WeatherTipsResponse; fromCache: boolean }
  | { ok: false; message: string };

// SecureStore rejects ":" in keys; namespaces use "." (alphanumeric, ".", "-", "_" only).
const LAST_RESPONSE_KEY = "leaflet.weather-last-response";

type CachedResponse = {
  localDate: string;
  latitude: number;
  longitude: number;
  response: WeatherTipsResponse;
};

async function readLastResponse(): Promise<CachedResponse | null> {
  try {
    const raw = await secureStorageAdapter.getItem(LAST_RESPONSE_KEY);

    return raw ? (JSON.parse(raw) as CachedResponse) : null;
  } catch {
    return null;
  }
}

async function writeLastResponse(value: CachedResponse) {
  try {
    await secureStorageAdapter.setItem(LAST_RESPONSE_KEY, JSON.stringify(value));
  } catch {
    // Local snapshot cache is best-effort only.
  }
}

export async function fetchWeatherTips(
  location: StoredUserLocation
): Promise<WeatherTipsResult> {
  const localDate = getLocalDateString();
  const { data, error } = await getSupabaseClient().functions.invoke<WeatherTipsResponse>(
    "weather-tips",
    {
      body: {
        latitude: location.latitude,
        longitude: location.longitude,
        localDate
      }
    }
  );

  if (!error && data?.weather) {
    await writeLastResponse({
      localDate,
      latitude: location.latitude,
      longitude: location.longitude,
      response: data
    });

    return { ok: true, data, fromCache: false };
  }

  // Function or provider down: serve the last same-day snapshot for the same
  // coords; otherwise the caller falls back to species-only guidance.
  const cached = await readLastResponse();

  if (
    cached &&
    cached.localDate === localDate &&
    cached.latitude === location.latitude &&
    cached.longitude === location.longitude
  ) {
    return { ok: true, data: cached.response, fromCache: true };
  }

  return {
    ok: false,
    message: "Weather tips are unavailable right now."
  };
}
