// Deterministic weather-tip rule engine. Pure module: no Deno, no DB, no fetch —
// signals are derived only from weather × species care_profile × placement, so
// the LLM never invents care advice (it may only rephrase these messages).

export type PlantPlacement = "indoor" | "outdoor" | "balcony" | "unknown";
export type LightExposure = "low" | "medium" | "bright" | "unknown";

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

export type WeatherTipAction = {
  kind: "snooze_watering" | "advance_watering";
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

export type EngineCareTask = {
  id: string;
  nextDueDate: string;
  intervalDays: number;
};

export type EnginePlant = {
  id: string;
  name: string;
  placement: PlantPlacement;
  lightExposure: LightExposure;
  careProfile: Record<string, unknown> | null;
  waterTask: EngineCareTask | null;
  mistTask: EngineCareTask | null;
};

// Starting points, deliberately conservative — a false "bring it in" is far
// cheaper than a missed freeze. Tune from feedback; remote-config later.
export const TIP_THRESHOLDS = {
  frostWarnC: 4,
  frostHardC: 0,
  heatMaxC: 32,
  heatWarmC: 28,
  heatUvMin: 8,
  rainProbabilityMin: 60,
  rainDueWithinDays: 1,
  heatingSeasonMaxC: 10,
  lowDaylightHours: 10,
  highHumidityMin: 80
};

const MAX_TIPS = 3;

const SEVERITY_RANK: Record<WeatherTipSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1
};

// Tie-break within a severity: direct physical risk first.
const SIGNAL_RANK: Record<WeatherSignalKind, number> = {
  frost: 6,
  heat: 5,
  rain: 4,
  dry_air: 3,
  high_humidity: 2,
  low_light: 1
};

function careText(profile: Record<string, unknown> | null, key: string) {
  const value = profile?.[key];

  return typeof value === "string" ? value : "";
}

// Mirrors hasHighHumidityNeed in lib/api/careSchedule.ts.
export function hasHighHumidityNeed(text: string) {
  const normalized = text.toLowerCase();

  if (!normalized) {
    return false;
  }

  if (/\b(low humidity|dry air|avoid mist|do not mist|no mist)\b/.test(normalized)) {
    return false;
  }

  const percentages = [...normalized.matchAll(/(\d{2,3})\s*%/g)].map((match) =>
    Number(match[1])
  );

  if (percentages.some((percentage) => percentage >= 60)) {
    return true;
  }

  return /\b(high humidity|humid|misting|mist regularly|tropical|moist air)\b/.test(
    normalized
  );
}

export function isColdSensitive(temperatureText: string) {
  const normalized = temperatureText.toLowerCase();

  if (!normalized) {
    return false;
  }

  if (/\b(frost hardy|cold hardy|hardy to|tolerates frost)\b/.test(normalized)) {
    return false;
  }

  if (/\b(tropical|warm|no frost|frost[-\s]?sensitive|not below|above)\b/.test(normalized)) {
    return true;
  }

  // "Minimum 10°C / 50°F" style guidance implies cold sensitivity.
  const celsiusMinimums = [...normalized.matchAll(/(\d{1,2})\s*°?\s*c\b/g)].map(
    (match) => Number(match[1])
  );

  return celsiusMinimums.some((value) => value >= 10 && value <= 18);
}

function daysBetweenLocalDates(fromDateString: string, toDateString: string) {
  const parse = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);

    return Date.UTC(year, (month ?? 1) - 1, day ?? 1);
  };

  return Math.round((parse(toDateString) - parse(fromDateString)) / 86_400_000);
}

function isOutdoorish(placement: PlantPlacement) {
  return placement === "outdoor" || placement === "balcony";
}

type CandidateTip = WeatherTip & { rank: number };

function candidate(
  tip: Omit<WeatherTip, "phrased" | "id">
): CandidateTip {
  return {
    ...tip,
    id: `${tip.signal}.${tip.plantId ?? "all"}`,
    phrased: false,
    rank: SEVERITY_RANK[tip.severity] * 10 + SIGNAL_RANK[tip.signal]
  };
}

export function deriveWeatherTips({
  weather,
  plants,
  localDate
}: {
  weather: WeatherSnapshot;
  plants: EnginePlant[];
  localDate: string;
}): WeatherTip[] {
  if (plants.length === 0) {
    return [];
  }

  const t = TIP_THRESHOLDS;
  const today = weather.today;
  const overnightMin = Math.min(
    today.minTemp,
    weather.tomorrow?.minTemp ?? today.minTemp
  );
  const tips: CandidateTip[] = [];

  for (const plant of plants) {
    const outdoors = isOutdoorish(plant.placement);
    const humidityText = careText(plant.careProfile, "humidity");
    const temperatureText = careText(plant.careProfile, "temperature");
    const waterDueInDays = plant.waterTask
      ? daysBetweenLocalDates(localDate, plant.waterTask.nextDueDate)
      : null;

    // Frost / freeze risk — the one signal worth a notification.
    if (outdoors && overnightMin <= t.frostWarnC) {
      tips.push(
        candidate({
          signal: "frost",
          severity: "high",
          plantId: plant.id,
          plantName: plant.name,
          notify: true,
          message: `Frost risk tonight (low ${Math.round(overnightMin)}°C). Bring ${plant.name} indoors or cover it.`,
          action: null
        })
      );
    } else if (
      !outdoors &&
      overnightMin <= t.frostHardC &&
      plant.lightExposure === "bright" &&
      isColdSensitive(temperatureText)
    ) {
      tips.push(
        candidate({
          signal: "frost",
          severity: "low",
          plantId: plant.id,
          plantName: plant.name,
          notify: false,
          message: `Freezing outside tonight (${Math.round(overnightMin)}°C). Move ${plant.name} back from the cold window glass.`,
          action: null
        })
      );
    }

    // Heat wave — soil dries faster; suggest watering early, never silently.
    const isHot =
      today.maxTemp >= t.heatMaxC ||
      (today.maxTemp >= t.heatWarmC && today.uvIndexMax >= t.heatUvMin);

    if (isHot && (outdoors || plant.lightExposure === "bright")) {
      const canAdvance =
        plant.waterTask !== null && waterDueInDays !== null && waterDueInDays >= 1;

      tips.push(
        candidate({
          signal: "heat",
          severity: "medium",
          plantId: plant.id,
          plantName: plant.name,
          notify: false,
          message: `Hot and bright today (up to ${Math.round(today.maxTemp)}°C). Check ${plant.name}'s soil a day early — it will dry faster.`,
          action: canAdvance
            ? {
                kind: "advance_watering",
                taskId: plant.waterTask!.id,
                days: 1,
                label: "Water a day early"
              }
            : null
        })
      );
    }

    // Rain incoming — outdoor watering due soon can wait.
    if (
      outdoors &&
      today.precipitationProbability >= t.rainProbabilityMin &&
      plant.waterTask &&
      waterDueInDays !== null &&
      waterDueInDays <= t.rainDueWithinDays
    ) {
      tips.push(
        candidate({
          signal: "rain",
          severity: "medium",
          plantId: plant.id,
          plantName: plant.name,
          notify: false,
          message: `Rain is likely today (${Math.round(today.precipitationProbability)}%). Let the sky water ${plant.name} and skip your watering.`,
          action: {
            kind: "snooze_watering",
            taskId: plant.waterTask.id,
            days: 2,
            label: "Snooze watering 2 days"
          }
        })
      );
    }

    // Dry indoor air — heating season bakes humidity-loving plants.
    if (
      !outdoors &&
      today.maxTemp <= t.heatingSeasonMaxC &&
      hasHighHumidityNeed(humidityText)
    ) {
      tips.push(
        candidate({
          signal: "dry_air",
          severity: "low",
          plantId: plant.id,
          plantName: plant.name,
          notify: false,
          message: `Cold outside means heating dries your indoor air. Mist ${plant.name} or group it with your other tropicals.`,
          action: null
        })
      );
    }

    // High humidity — pause misting to avoid fungal issues.
    if (
      plant.mistTask &&
      weather.current.humidity >= t.highHumidityMin
    ) {
      tips.push(
        candidate({
          signal: "high_humidity",
          severity: "low",
          plantId: plant.id,
          plantName: plant.name,
          notify: false,
          message: `The air is already humid today (${Math.round(weather.current.humidity)}%). Hold off misting ${plant.name} to avoid fungal issues.`,
          action: null
        })
      );
    }
  }

  // Low light / short days — one collection-wide tip, not per plant.
  const isOvercast = [3, 45, 48].includes(today.weatherCode);

  if (today.daylightHours < t.lowDaylightHours || isOvercast) {
    tips.push(
      candidate({
        signal: "low_light",
        severity: "low",
        plantId: null,
        plantName: null,
        notify: false,
        message:
          "Light is low today, so growth slows down. Your plants will drink less — ease off watering a touch.",
        action: null
      })
    );
  }

  return tips
    .sort((left, right) => right.rank - left.rank)
    .slice(0, MAX_TIPS)
    .map(({ rank: _rank, ...tip }) => tip);
}

export function tipSignature({
  latitude,
  longitude,
  localDate,
  tips
}: {
  latitude: number;
  longitude: number;
  localDate: string;
  tips: WeatherTip[];
}) {
  const parts = tips.map(
    (tip) => `${tip.id}:${tip.severity}:${tip.plantName ?? ""}`
  );

  return `${latitude},${longitude},${localDate}|${parts.join("|")}`;
}
