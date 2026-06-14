import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2";

import {
  deriveWeatherTips,
  tipSignature,
  type EnginePlant,
  type LightExposure,
  type PlantPlacement,
  type WeatherSnapshot,
  type WeatherTip
} from "./engine.ts";
import { openMeteoProvider } from "./provider.ts";

const FORECAST_DAYS = 2;
const SNAPSHOT_TTL_MS = 3 * 60 * 60 * 1000;
const OPENAI_TIPS_MODEL = Deno.env.get("OPENAI_TIPS_MODEL") ?? "gpt-4o-mini";
const LLM_TIMEOUT_MS = 6000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim();
}

function roundCoordinate(value: number) {
  return Math.round(value * 100) / 100;
}

function utcDateString() {
  return new Date().toISOString().slice(0, 10);
}

function validateBody(body: Record<string, unknown>) {
  const latitude = body.latitude;
  const longitude = body.longitude;
  const localDate = body.localDate ?? body.local_date;

  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180
  ) {
    return { ok: false as const, message: "latitude and longitude are required." };
  }

  const normalizedDate =
    typeof localDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(localDate)
      ? localDate
      : utcDateString();

  return {
    ok: true as const,
    value: {
      latitude: roundCoordinate(latitude),
      longitude: roundCoordinate(longitude),
      localDate: normalizedDate
    }
  };
}

type PlantRow = {
  id: string;
  nickname: string | null;
  placement: PlantPlacement;
  light_exposure: LightExposure;
  species: {
    common_name: string;
    care_profile: Record<string, unknown> | null;
  } | null;
};

type TaskRow = {
  id: string;
  user_plant_id: string;
  type: string;
  next_due_date: string;
  interval_days: number;
};

async function loadEnginePlants(
  userClient: ReturnType<typeof createClient>,
  userId: string
): Promise<EnginePlant[]> {
  const [plantsResult, tasksResult] = await Promise.all([
    userClient
      .from("user_plants")
      .select(
        "id, nickname, placement, light_exposure, species:species_id(common_name, care_profile)"
      )
      .eq("user_id", userId),
    userClient
      .from("care_tasks")
      .select("id, user_plant_id, type, next_due_date, interval_days")
      .eq("user_id", userId)
      .eq("is_active", true)
      .in("type", ["water", "mist"])
  ]);

  if (plantsResult.error) {
    throw new Error("Plants could not be loaded.");
  }

  const tasks = (tasksResult.data ?? []) as TaskRow[];
  const tasksByPlant = new Map<string, TaskRow[]>();

  for (const task of tasks) {
    const list = tasksByPlant.get(task.user_plant_id) ?? [];

    list.push(task);
    tasksByPlant.set(task.user_plant_id, list);
  }

  return ((plantsResult.data ?? []) as unknown as PlantRow[]).map((row) => {
    const plantTasks = tasksByPlant.get(row.id) ?? [];
    const toEngineTask = (type: string) => {
      const task = plantTasks.find((candidate) => candidate.type === type);

      return task
        ? {
            id: task.id,
            nextDueDate: task.next_due_date,
            intervalDays: task.interval_days
          }
        : null;
    };

    return {
      id: row.id,
      name: row.nickname?.trim() || row.species?.common_name || "your plant",
      placement: row.placement,
      lightExposure: row.light_exposure,
      careProfile: row.species?.care_profile ?? null,
      waterTask: toEngineTask("water"),
      mistTask: toEngineTask("mist")
    };
  });
}

async function getWeatherSnapshot(
  adminClient: ReturnType<typeof createClient>,
  input: { latitude: number; longitude: number; localDate: string }
): Promise<WeatherSnapshot | null> {
  const { data: cached } = await adminClient
    .from("weather_cache")
    .select("snapshot, updated_at")
    .eq("latitude", input.latitude)
    .eq("longitude", input.longitude)
    .eq("local_date", input.localDate)
    .eq("forecast_days", FORECAST_DAYS)
    .maybeSingle();

  const isFresh =
    cached &&
    Date.now() - new Date(cached.updated_at as string).getTime() < SNAPSHOT_TTL_MS;

  if (cached && isFresh) {
    return cached.snapshot as WeatherSnapshot;
  }

  try {
    const snapshot = await openMeteoProvider.fetchForecast({
      latitude: input.latitude,
      longitude: input.longitude,
      forecastDays: FORECAST_DAYS
    });

    await adminClient.from("weather_cache").upsert(
      {
        latitude: input.latitude,
        longitude: input.longitude,
        local_date: input.localDate,
        forecast_days: FORECAST_DAYS,
        snapshot
      },
      { onConflict: "latitude,longitude,local_date,forecast_days" }
    );

    return snapshot;
  } catch {
    // Provider hiccup: a stale same-day snapshot still beats no weather.
    return cached ? (cached.snapshot as WeatherSnapshot) : null;
  }
}

async function phraseTips(tips: WeatherTip[]): Promise<WeatherTip[] | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");

  if (!apiKey || tips.length === 0) {
    return null;
  }

  const payload = tips.map((tip) => ({
    id: tip.id,
    plant: tip.plantName,
    message: tip.message
  }));

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_TIPS_MODEL,
        temperature: 0.7,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You rewrite plant-care weather tips for the Leaflet app: warm, brief, friendly, plain language. Rephrase each provided message without changing its facts, numbers, plant names, or advice. Never add new care advice. Return JSON: {\"tips\":[{\"id\":\"string\",\"message\":\"string\"}]}."
          },
          {
            role: "user",
            content: JSON.stringify({ tips: payload })
          }
        ]
      })
    });

    if (!response.ok) {
      return null;
    }

    const completion = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = completion.choices?.[0]?.message?.content;

    if (!content) {
      return null;
    }

    const parsed = JSON.parse(content) as {
      tips?: { id?: unknown; message?: unknown }[];
    };

    if (!Array.isArray(parsed.tips)) {
      return null;
    }

    const phrasedById = new Map<string, string>();

    for (const item of parsed.tips) {
      if (typeof item.id === "string" && typeof item.message === "string" && item.message.trim()) {
        phrasedById.set(item.id, item.message.trim());
      }
    }

    return tips.map((tip) => {
      const message = phrasedById.get(tip.id);

      return message ? { ...tip, message, phrased: true } : tip;
    });
  } catch {
    // LLM phrasing is optional/degradable: rule templates always render.
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ code: "method_not_allowed", message: "Use POST." }, 405);
  }

  const token = getBearerToken(req);

  if (!token) {
    return jsonResponse({ code: "auth_required", message: "Sign in to get weather tips." }, 401);
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ code: "invalid_request", message: "Body must be JSON." }, 400);
  }

  const validation = validateBody(body);

  if (!validation.ok) {
    return jsonResponse({ code: "invalid_request", message: validation.message }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false }
  });
  const adminClient = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const {
    data: { user },
    error: userError
  } = await userClient.auth.getUser(token);

  if (userError || !user) {
    return jsonResponse({ code: "auth_required", message: "Sign in to get weather tips." }, 401);
  }

  const { latitude, longitude, localDate } = validation.value;
  const weather = await getWeatherSnapshot(adminClient, {
    latitude,
    longitude,
    localDate
  });

  if (!weather) {
    return jsonResponse(
      { code: "weather_unavailable", message: "Weather is unavailable right now." },
      503
    );
  }

  let plants: EnginePlant[];

  try {
    plants = await loadEnginePlants(userClient, user.id);
  } catch {
    return jsonResponse(
      { code: "plants_unavailable", message: "Your plants could not be loaded." },
      500
    );
  }

  let tips = deriveWeatherTips({ weather, plants, localDate });

  if (tips.length > 0) {
    const signature = tipSignature({ latitude, longitude, localDate, tips });
    const { data: cachedTips } = await adminClient
      .from("weather_tip_cache")
      .select("signature, tips")
      .eq("user_id", user.id)
      .eq("local_date", localDate)
      .maybeSingle();

    if (cachedTips && cachedTips.signature === signature) {
      tips = cachedTips.tips as WeatherTip[];
    } else {
      const phrased = await phraseTips(tips);

      if (phrased) {
        tips = phrased;
        await adminClient.from("weather_tip_cache").upsert(
          { user_id: user.id, local_date: localDate, signature, tips },
          { onConflict: "user_id,local_date" }
        );
      }
    }
  }

  return jsonResponse({ weather, tips });
});
