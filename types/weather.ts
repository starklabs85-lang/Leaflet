// Shared shapes for the weather-tips Edge Function. Keep in sync with
// supabase/functions/weather-tips/engine.ts (the server is the source of truth).

export type WeatherDaySummary = {
  date: string;
  minTemp: number;
  maxTemp: number;
  precipitationProbability: number;
  precipitationSum: number;
  uvIndexMax: number;
  daylightHours: number;
  weatherCode: number;
  windSpeedMax: number;
};

export type WeatherSnapshot = {
  latitude: number;
  longitude: number;
  timezone: string;
  fetchedAt: string;
  current: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    weatherCode: number;
  };
  today: WeatherDaySummary;
  tomorrow: WeatherDaySummary | null;
};

export type WeatherSignalKind =
  | "frost"
  | "heat"
  | "rain"
  | "dry_air"
  | "low_light"
  | "high_humidity";

export type WeatherTipSeverity = "high" | "medium" | "low";

export type WeatherTipActionKind = "snooze_watering" | "advance_watering";

export type WeatherTipAction = {
  kind: WeatherTipActionKind;
  taskId: string;
  days: number;
  label: string;
};

export type WeatherTip = {
  id: string;
  signal: WeatherSignalKind;
  severity: WeatherTipSeverity;
  plantId: string | null;
  plantName: string | null;
  message: string;
  phrased: boolean;
  notify: boolean;
  action: WeatherTipAction | null;
};

export type WeatherTipsResponse = {
  weather: WeatherSnapshot;
  tips: WeatherTip[];
};
