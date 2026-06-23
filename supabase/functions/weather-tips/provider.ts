// Weather provider behind a small interface so Open-Meteo can be swapped for a
// keyed provider later without touching the engine or the function handler.

import type { WeatherDaySummary, WeatherSnapshot } from "./engine.ts";

export interface WeatherProvider {
  fetchForecast(input: {
    latitude: number;
    longitude: number;
    forecastDays: number;
  }): Promise<WeatherSnapshot>;
}

type OpenMeteoResponse = {
  timezone?: string;
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
  daily?: {
    time?: string[];
    temperature_2m_min?: number[];
    temperature_2m_max?: number[];
    precipitation_probability_max?: (number | null)[];
    precipitation_sum?: number[];
    uv_index_max?: (number | null)[];
    daylight_duration?: number[];
    weather_code?: number[];
    wind_speed_10m_max?: number[];
  };
};

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function dayAt(daily: OpenMeteoResponse["daily"], index: number): WeatherDaySummary | null {
  const date = daily?.time?.[index];

  if (!date) {
    return null;
  }

  return {
    date,
    minTemp: asNumber(daily?.temperature_2m_min?.[index], 99),
    maxTemp: asNumber(daily?.temperature_2m_max?.[index], -99),
    precipitationProbability: asNumber(
      daily?.precipitation_probability_max?.[index],
      0
    ),
    precipitationSum: asNumber(daily?.precipitation_sum?.[index], 0),
    uvIndexMax: asNumber(daily?.uv_index_max?.[index], 0),
    daylightHours: asNumber(daily?.daylight_duration?.[index], 12 * 3600) / 3600,
    weatherCode: asNumber(daily?.weather_code?.[index], 0),
    windSpeedMax: asNumber(daily?.wind_speed_10m_max?.[index], 0)
  };
}

export const openMeteoProvider: WeatherProvider = {
  async fetchForecast({ latitude, longitude, forecastDays }) {
    const url = new URL("https://api.open-meteo.com/v1/forecast");

    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code"
    );
    url.searchParams.set(
      "daily",
      [
        "temperature_2m_min",
        "temperature_2m_max",
        "precipitation_probability_max",
        "precipitation_sum",
        "uv_index_max",
        "daylight_duration",
        "weather_code",
        "wind_speed_10m_max"
      ].join(",")
    );
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", String(forecastDays));

    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo responded with ${response.status}.`);
    }

    const payload = (await response.json()) as OpenMeteoResponse;
    const today = dayAt(payload.daily, 0);

    if (!today) {
      throw new Error("Open-Meteo returned no daily forecast.");
    }

    return {
      latitude,
      longitude,
      timezone: payload.timezone ?? "UTC",
      fetchedAt: new Date().toISOString(),
      current: {
        temperature: asNumber(payload.current?.temperature_2m, today.maxTemp),
        humidity: asNumber(payload.current?.relative_humidity_2m, 50),
        windSpeed: asNumber(payload.current?.wind_speed_10m, 0),
        weatherCode: asNumber(payload.current?.weather_code, today.weatherCode)
      },
      today,
      tomorrow: dayAt(payload.daily, 1)
    };
  }
};
