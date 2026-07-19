import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2";
import { getScanAccess, type ScanType } from "./access.ts";

type Difficulty = "easy" | "moderate" | "hard";
type DiagnosisCategory =
  | "disease"
  | "pest"
  | "nutrient_deficiency"
  | "environmental"
  | "unknown";
type DiagnosisSeverity = "mild" | "moderate" | "severe";

type IdentifyPlantRequest = {
  imageBase64?: unknown;
  scanType?: unknown;
  scan_type?: unknown;
  imageMimeType?: unknown;
  clientRequestId?: unknown;
  client_request_id?: unknown;
  speciesContext?: unknown;
  species_context?: unknown;
};

type SpeciesContext = {
  userPlantId?: string | null;
  plantName?: string | null;
  commonName?: string | null;
  scientificName?: string | null;
};

type OpenAIPlantResult = {
  primary?: {
    common_name?: unknown;
    scientific_name?: unknown;
    confidence?: unknown;
    description?: unknown;
  };
  alternates?: unknown;
  care_profile?: {
    light?: unknown;
    water?: unknown;
    humidity?: unknown;
    temperature?: unknown;
    soil?: unknown;
    feeding?: unknown;
    difficulty?: unknown;
    toxicity?: unknown;
  };
  is_plant?: unknown;
};

type OpenAIDiagnosisResult = {
  condition?: {
    name?: unknown;
    confidence?: unknown;
    category?: unknown;
  };
  cause?: unknown;
  treatment?: unknown;
  prevention?: unknown;
  severity?: unknown;
  follow_up_days?: unknown;
  is_healthy?: unknown;
};

type IdentifyPlantResult =
  | {
      isPlant: true;
      primary: {
        commonName: string;
        scientificName: string;
        confidence: number;
        description: string;
      };
      alternates: {
        commonName: string;
        scientificName: string;
        confidence: number;
        description?: string;
      }[];
      careProfile: {
        light: string;
        water: string;
        humidity: string;
        temperature: string;
        soil: string;
        feeding: string;
        difficulty: Difficulty;
        toxicity: string;
      };
      speciesId: string | null;
    }
  | {
      isPlant: false;
      message: string;
    };

type PlantDiagnosisResult = {
  condition: {
    name: string;
    confidence: number;
    category: DiagnosisCategory;
  };
  cause: string;
  treatment: string[];
  prevention: string;
  severity: DiagnosisSeverity;
  followUpDays: number;
  isHealthy: boolean;
};

const MAX_IMAGE_BASE64_LENGTH = 12_000_000;
// Premium is "unlimited" product-wise; this is purely an anti-abuse backstop
// (each scan costs an OpenAI call).
const MAX_PREMIUM_SCANS_PER_HOUR = 30;
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o";

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
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders
  });
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim();
}

function normalizeSpeciesContext(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  return {
    userPlantId: optionalString(record.userPlantId),
    plantName: optionalString(record.plantName),
    commonName: optionalString(record.commonName),
    scientificName: optionalString(record.scientificName)
  } satisfies SpeciesContext;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function validateRequestBody(body: IdentifyPlantRequest) {
  const errors: string[] = [];
  const scanType = body.scanType ?? body.scan_type;
  const clientRequestId = body.clientRequestId ?? body.client_request_id;
  const speciesContext = body.speciesContext ?? body.species_context;

  if (typeof body.imageBase64 !== "string" || body.imageBase64.trim().length === 0) {
    errors.push("imageBase64 is required.");
  } else if (body.imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    errors.push("imageBase64 is too large.");
  } else if (!/^[A-Za-z0-9+/=]+$/.test(body.imageBase64)) {
    errors.push("imageBase64 must be a base64 encoded image.");
  }

  if (scanType !== "identify" && scanType !== "diagnose") {
    errors.push("scan_type must be identify or diagnose.");
  }

  if (body.imageMimeType !== "image/jpeg") {
    errors.push("imageMimeType must be image/jpeg.");
  }

  if (clientRequestId !== undefined && typeof clientRequestId !== "string") {
    errors.push("clientRequestId must be a string.");
  }

  if (
    speciesContext !== undefined &&
    speciesContext !== null &&
    (typeof speciesContext !== "object" || Array.isArray(speciesContext))
  ) {
    errors.push("speciesContext must be an object.");
  }

  if (errors.length > 0) {
    return { ok: false as const, errors };
  }

  return {
    ok: true as const,
    value: {
      imageBase64: body.imageBase64 as string,
      scanType: scanType as ScanType,
      imageMimeType: body.imageMimeType as "image/jpeg",
      clientRequestId: clientRequestId as string | undefined,
      speciesContext: normalizeSpeciesContext(speciesContext)
    }
  };
}

async function sha256(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function parseJsonObject(content: string) {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("OpenAI returned a response that was not JSON.");
    }

    return JSON.parse(match[0]) as unknown;
  }
}

function asNonEmptyString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is missing.`);
  }

  return value.trim();
}

function asStringWithDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asConfidence(value: unknown, fieldName: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${fieldName} is missing.`);
  }

  return Math.min(1, Math.max(0, value));
}

function asDifficulty(value: unknown) {
  if (value === "easy" || value === "moderate" || value === "hard") {
    return value;
  }

  return "moderate";
}

function asCategory(value: unknown): DiagnosisCategory {
  if (
    value === "disease" ||
    value === "pest" ||
    value === "nutrient_deficiency" ||
    value === "environmental" ||
    value === "unknown"
  ) {
    return value;
  }

  return "unknown";
}

function asSeverity(value: unknown): DiagnosisSeverity {
  if (value === "mild" || value === "moderate" || value === "severe") {
    return value;
  }

  return "mild";
}

function asFollowUpDays(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    return 7;
  }

  return Math.min(60, Math.round(value));
}

function normalizeTreatment(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("treatment must be an array.");
  }

  const steps = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, 6)
    .map((item) => item.trim());

  if (steps.length === 0) {
    throw new Error("treatment needs at least one step.");
  }

  return steps;
}

function normalizeOpenAIPlantResult(value: unknown): IdentifyPlantResult {
  const result = value as OpenAIPlantResult;

  if (result.is_plant === false) {
    return {
      isPlant: false,
      message:
        "We could not find a plant in this photo. Try again with leaves or the full plant clearly in frame."
    };
  }

  if (result.is_plant !== true) {
    throw new Error("is_plant must be true or false.");
  }

  const primary = result.primary;
  const careProfile = result.care_profile;

  if (!primary || !careProfile) {
    throw new Error("Plant result is missing primary or care_profile.");
  }

  const alternates = Array.isArray(result.alternates) ? result.alternates : [];

  return {
    isPlant: true,
    primary: {
      commonName: asNonEmptyString(primary.common_name, "primary.common_name"),
      scientificName: asNonEmptyString(
        primary.scientific_name,
        "primary.scientific_name"
      ),
      confidence: asConfidence(primary.confidence, "primary.confidence"),
      description: asNonEmptyString(primary.description, "primary.description")
    },
    alternates: alternates.slice(0, 4).map((alternate, index) => {
      const item = alternate as OpenAIPlantResult["primary"];

      if (!item) {
        throw new Error(`alternates[${index}] is invalid.`);
      }

      return {
        commonName: asNonEmptyString(
          item.common_name,
          `alternates[${index}].common_name`
        ),
        scientificName: asNonEmptyString(
          item.scientific_name,
          `alternates[${index}].scientific_name`
        ),
        confidence: asConfidence(item.confidence, `alternates[${index}].confidence`)
      };
    }),
    careProfile: {
      light: asNonEmptyString(careProfile.light, "care_profile.light"),
      water: asNonEmptyString(careProfile.water, "care_profile.water"),
      humidity: asNonEmptyString(careProfile.humidity, "care_profile.humidity"),
      temperature: asNonEmptyString(
        careProfile.temperature,
        "care_profile.temperature"
      ),
      soil: asNonEmptyString(careProfile.soil, "care_profile.soil"),
      feeding: asNonEmptyString(careProfile.feeding, "care_profile.feeding"),
      difficulty: asDifficulty(careProfile.difficulty),
      toxicity: asNonEmptyString(careProfile.toxicity, "care_profile.toxicity")
    },
    speciesId: null
  };
}

function normalizeOpenAIDiagnosisResult(value: unknown): PlantDiagnosisResult {
  const result = value as OpenAIDiagnosisResult;
  const condition = result.condition ?? {};
  const isHealthy = result.is_healthy === true;
  const confidence = asConfidence(condition.confidence ?? 0.6, "condition.confidence");

  return {
    condition: {
      name: isHealthy
        ? asStringWithDefault(condition.name, "Healthy plant")
        : asNonEmptyString(condition.name, "condition.name"),
      confidence,
      category: isHealthy ? "unknown" : asCategory(condition.category)
    },
    cause: asStringWithDefault(
      result.cause,
      isHealthy
        ? "The visible foliage does not show clear signs of disease or pest pressure."
        : "The likely cause could not be determined from this image."
    ),
    treatment: isHealthy
      ? [
          "Keep monitoring the plant in consistent light.",
          "Photograph a specific affected area again if symptoms appear."
        ]
      : normalizeTreatment(result.treatment),
    prevention: asStringWithDefault(
      result.prevention,
      "Keep care consistent and inspect new growth regularly."
    ),
    severity: isHealthy ? "mild" : asSeverity(result.severity),
    followUpDays: asFollowUpDays(result.follow_up_days),
    isHealthy
  };
}

function speciesContextText(context: SpeciesContext | null) {
  if (!context) {
    return "";
  }

  const commonName = context.commonName ?? context.plantName;
  const scientificName = context.scientificName;

  if (commonName && scientificName) {
    return `The plant is a ${commonName} (${scientificName}).`;
  }

  if (commonName) {
    return `The plant is a ${commonName}.`;
  }

  if (scientificName) {
    return `The plant is ${scientificName}.`;
  }

  return "";
}

async function callOpenAI({
  imageBase64,
  imageMimeType,
  scanType,
  speciesContext
}: {
  imageBase64: string;
  imageMimeType: string;
  scanType: ScanType;
  speciesContext: SpeciesContext | null;
}) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");

  if (!apiKey) {
    return {
      ok: false as const,
      status: 500,
      code: "missing_openai_key",
      message: "Plant scanning is not configured yet."
    };
  }

  const userText =
    scanType === "identify"
      ? "Analyze the image and return this exact JSON shape: {\"primary\":{\"common_name\":\"string\",\"scientific_name\":\"string\",\"confidence\":0.0,\"description\":\"1-2 sentence description\"},\"alternates\":[{\"common_name\":\"string\",\"scientific_name\":\"string\",\"confidence\":0.0}],\"care_profile\":{\"light\":\"string\",\"water\":\"string\",\"humidity\":\"string\",\"temperature\":\"string\",\"soil\":\"string\",\"feeding\":\"string\",\"difficulty\":\"easy|moderate|hard\",\"toxicity\":\"string\"},\"is_plant\":true}. If the image does not contain a plant, return {\"is_plant\":false}. Provide 2-4 alternates ranked by confidence. Be specific about species, not just genus."
      : `${speciesContextText(
          speciesContext
        )} Analyze the image of a plant showing possible distress. Return this exact JSON shape: {\"condition\":{\"name\":\"string\",\"confidence\":0.0,\"category\":\"disease|pest|nutrient_deficiency|environmental|unknown\"},\"cause\":\"1-2 sentence likely cause\",\"treatment\":[\"Step 1: ...\",\"Step 2: ...\",\"Step 3: ...\"],\"prevention\":\"1-2 sentence prevention advice\",\"severity\":\"mild|moderate|severe\",\"follow_up_days\":7,\"is_healthy\":false}. If the plant appears healthy, set is_healthy to true and use condition.name \"Healthy plant\". If uncertain, set confidence below 0.3 and explain the limitation in cause. Treatment steps must be specific and actionable for a home gardener.`;

  const systemText =
    scanType === "identify"
      ? "You are a plant identification expert. Return only valid JSON. Identify specific plant species from images when possible."
      : "You are a plant disease and pest diagnosis expert. Return only valid JSON. Use cautious advisory language and avoid claiming certainty beyond the image.";

  const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      temperature: scanType === "identify" ? 0.2 : 0.1,
      max_tokens: scanType === "identify" ? 1200 : 1100,
      messages: [
        {
          role: "system",
          content: systemText
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userText
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${imageMimeType};base64,${imageBase64}`,
                detail: "low"
              }
            }
          ]
        }
      ]
    })
  });

  if (!openAIResponse.ok) {
    return {
      ok: false as const,
      status: 503,
      code: "openai_unavailable",
      message: "Plant scanning is busy right now. Please try again shortly."
    };
  }

  const payload = await openAIResponse.json();
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    return {
      ok: false as const,
      status: 502,
      code: "validation_failed",
      message: "The plant result could not be read. Please try another photo."
    };
  }

  try {
    const parsed = parseJsonObject(content);

    return {
      ok: true as const,
      result:
        scanType === "identify"
          ? normalizeOpenAIPlantResult(parsed)
          : normalizeOpenAIDiagnosisResult(parsed)
    };
  } catch {
    return {
      ok: false as const,
      status: 502,
      code: "validation_failed",
      message: "The plant result was incomplete. Please try a clearer photo."
    };
  }
}

async function getIsPremium(
  adminClient: ReturnType<typeof createClient>,
  userId: string
) {
  const { data } = await adminClient
    .from("subscriptions")
    .select("plan, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data || data.plan !== "premium") {
    return false;
  }

  return !data.expires_at || new Date(data.expires_at as string) > new Date();
}

async function upsertSpecies(
  adminClient: ReturnType<typeof createClient>,
  result: IdentifyPlantResult
) {
  if (!result.isPlant) {
    return result;
  }

  const scientificName = result.primary.scientificName;

  const { data: existingSpecies } = await adminClient
    .from("species")
    .select("id")
    .ilike("scientific_name", scientificName)
    .maybeSingle();

  if (existingSpecies?.id) {
    return {
      ...result,
      speciesId: existingSpecies.id
    };
  }

  const { data: insertedSpecies, error } = await adminClient
    .from("species")
    .insert({
      common_name: result.primary.commonName,
      scientific_name: scientificName,
      description: result.primary.description,
      care_profile: result.careProfile
    })
    .select("id")
    .single();

  if (error || !insertedSpecies?.id) {
    return result;
  }

  return {
    ...result,
    speciesId: insertedSpecies.id
  };
}

function successStatus(scanType: ScanType, result: IdentifyPlantResult | PlantDiagnosisResult) {
  if (scanType === "identify") {
    return (result as IdentifyPlantResult).isPlant ? "identified" : "not_a_plant";
  }

  return (result as PlantDiagnosisResult).isHealthy ? "healthy" : "diagnosed";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "method_not_allowed",
          message: "Use POST for plant scan requests."
        }
      },
      405
    );
  }

  const token = getBearerToken(req);

  if (!token) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "unauthorized",
          message: "A valid Supabase session is required."
        }
      },
      401
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    }
  );

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "unauthorized",
          message: "A valid Supabase session is required."
        }
      },
      401
    );
  }

  let body: IdentifyPlantRequest;

  try {
    body = await req.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "invalid_json",
          message: "Request body must be valid JSON."
        }
      },
      400
    );
  }

  const validation = validateRequestBody(body);

  if (!validation.ok) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "invalid_request",
          message: validation.errors.join(" ")
        }
      },
      400
    );
  }

  const isPremium = await getIsPremium(adminClient, user.id);
  const access = getScanAccess({
    isPremium,
    scanType: validation.value.scanType
  });

  if (!access.allowed) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: access.code,
          message: access.message,
          scanType: validation.value.scanType
        }
      },
      402
    );
  }

  const imageHash = await sha256(validation.value.imageBase64);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count } = await adminClient
    .from("scan_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", oneHourAgo);

  if ((count ?? 0) >= MAX_PREMIUM_SCANS_PER_HOUR) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "rate_limited",
          message: "You have reached the scan limit. Please try again in about an hour.",
          retryAfterSeconds: 3600
        }
      },
      429
    );
  }

  const { data: cached } = await adminClient
    .from("scan_cache")
    .select("result")
    .eq("image_hash", imageHash)
    .eq("scan_type", validation.value.scanType)
    .maybeSingle();

  if (cached?.result) {
    await adminClient.from("scan_events").insert({
      user_id: user.id,
      image_hash: imageHash,
      scan_type: validation.value.scanType,
      cache_hit: true
    });

    const result = cached.result as IdentifyPlantResult | PlantDiagnosisResult;

    return jsonResponse({
      ok: true,
      data: {
        status: successStatus(validation.value.scanType, result),
        scanType: validation.value.scanType,
        cacheHit: true,
        result,
        userId: user.id,
        clientRequestId: validation.value.clientRequestId ?? null
      }
    });
  }

  const openAIResult = await callOpenAI({
    imageBase64: validation.value.imageBase64,
    imageMimeType: validation.value.imageMimeType,
    scanType: validation.value.scanType,
    speciesContext: validation.value.speciesContext
  });

  if (!openAIResult.ok) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: openAIResult.code,
          message: openAIResult.message
        }
      },
      openAIResult.status
    );
  }

  const result =
    validation.value.scanType === "identify"
      ? await upsertSpecies(adminClient, openAIResult.result as IdentifyPlantResult)
      : (openAIResult.result as PlantDiagnosisResult);

  await adminClient.from("scan_cache").insert({
    image_hash: imageHash,
    scan_type: validation.value.scanType,
    result
  });

  await adminClient.from("scan_events").insert({
    user_id: user.id,
    image_hash: imageHash,
    scan_type: validation.value.scanType,
    cache_hit: false
  });

  return jsonResponse({
    ok: true,
    data: {
      status: successStatus(validation.value.scanType, result),
      scanType: validation.value.scanType,
      cacheHit: false,
      result,
      userId: user.id,
      clientRequestId: validation.value.clientRequestId ?? null
    }
  });
});
