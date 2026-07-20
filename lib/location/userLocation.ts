import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";

export type UserLocationSource = "gps" | "manual";

export type StoredUserLocation = {
  // Rounded to 2 decimal places (~1 km) — coarse on purpose; used only for weather.
  latitude: number;
  longitude: number;
  label: string | null;
  source: UserLocationSource;
  updatedAt: string;
};

export type UserLocationErrorCode =
  | "permission_denied"
  | "unavailable"
  | "not_found"
  | "invalid_input";

export type UserLocationResult =
  | { ok: true; location: StoredUserLocation }
  | { ok: false; code: UserLocationErrorCode; message: string };

// SecureStore rejects ":" in keys; namespaces use "." (alphanumeric, ".", "-", "_" only).
const LOCATION_KEY = "leaflet.weather-location";
const PROMPT_SEEN_KEY = "leaflet.weather-location-prompt-seen";

const STALE_AFTER_DAYS = 14;

export function roundCoordinate(value: number) {
  return Math.round(value * 100) / 100;
}

function isValidStoredLocation(value: unknown): value is StoredUserLocation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as StoredUserLocation;

  return (
    typeof candidate.latitude === "number" &&
    Number.isFinite(candidate.latitude) &&
    typeof candidate.longitude === "number" &&
    Number.isFinite(candidate.longitude) &&
    (candidate.label === null || typeof candidate.label === "string") &&
    (candidate.source === "gps" || candidate.source === "manual") &&
    typeof candidate.updatedAt === "string"
  );
}

export async function getStoredUserLocation(): Promise<StoredUserLocation | null> {
  const raw = await SecureStore.getItemAsync(LOCATION_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (isValidStoredLocation(parsed)) {
      return parsed;
    }
  } catch {
    // Fall through to cleanup.
  }

  await SecureStore.deleteItemAsync(LOCATION_KEY);
  return null;
}

async function persistLocation(location: StoredUserLocation) {
  await SecureStore.setItemAsync(LOCATION_KEY, JSON.stringify(location));
}

export async function clearStoredUserLocation() {
  await SecureStore.deleteItemAsync(LOCATION_KEY);
}

export async function resetStoredUserLocation() {
  await Promise.all([
    SecureStore.deleteItemAsync(LOCATION_KEY),
    SecureStore.deleteItemAsync(PROMPT_SEEN_KEY)
  ]);
}

export function isLocationStale(
  location: StoredUserLocation,
  staleAfterDays = STALE_AFTER_DAYS
) {
  const updatedAt = new Date(location.updatedAt).getTime();

  if (!Number.isFinite(updatedAt)) {
    return true;
  }

  return Date.now() - updatedAt > staleAfterDays * 24 * 60 * 60 * 1000;
}

export async function shouldPromptForWeatherLocation() {
  const [stored, promptSeen] = await Promise.all([
    getStoredUserLocation(),
    SecureStore.getItemAsync(PROMPT_SEEN_KEY)
  ]);

  return !stored && promptSeen !== "true";
}

export async function markWeatherLocationPromptSeen() {
  await SecureStore.setItemAsync(PROMPT_SEEN_KEY, "true");
}

async function labelFromCoords(latitude: number, longitude: number) {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });

    return place?.city ?? place?.subregion ?? place?.region ?? null;
  } catch {
    // Label is cosmetic; never fail location capture over it.
    return null;
  }
}

export async function captureDeviceLocation(): Promise<UserLocationResult> {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== "granted") {
    return {
      ok: false,
      code: "permission_denied",
      message:
        "Location permission was declined. You can still set your city manually."
    };
  }

  let position: Location.LocationObject | null = null;

  try {
    position =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low
      }));
  } catch {
    position = null;
  }

  if (!position) {
    return {
      ok: false,
      code: "unavailable",
      message:
        "Your location could not be determined. Try again or set your city manually."
    };
  }

  const latitude = roundCoordinate(position.coords.latitude);
  const longitude = roundCoordinate(position.coords.longitude);
  const location: StoredUserLocation = {
    latitude,
    longitude,
    label: await labelFromCoords(latitude, longitude),
    source: "gps",
    updatedAt: new Date().toISOString()
  };

  await persistLocation(location);

  return { ok: true, location };
}

export async function setManualCityLocation(
  city: string
): Promise<UserLocationResult> {
  const trimmed = city.trim();

  if (!trimmed) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Enter a city name to set your weather location."
    };
  }

  let matches: Location.LocationGeocodedLocation[] = [];

  try {
    matches = await Location.geocodeAsync(trimmed);
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message: "City lookup is unavailable right now. Please try again."
    };
  }

  const match = matches[0];

  if (!match) {
    return {
      ok: false,
      code: "not_found",
      message: `"${trimmed}" could not be found. Try a nearby larger city.`
    };
  }

  const location: StoredUserLocation = {
    latitude: roundCoordinate(match.latitude),
    longitude: roundCoordinate(match.longitude),
    label: trimmed,
    source: "manual",
    updatedAt: new Date().toISOString()
  };

  await persistLocation(location);

  return { ok: true, location };
}

export async function refreshStoredLocationIfGps(): Promise<StoredUserLocation | null> {
  const stored = await getStoredUserLocation();

  if (!stored || stored.source !== "gps" || !isLocationStale(stored)) {
    return stored;
  }

  const permission = await Location.getForegroundPermissionsAsync();

  if (permission.status !== "granted") {
    return stored;
  }

  const refreshed = await captureDeviceLocation();

  return refreshed.ok ? refreshed.location : stored;
}
