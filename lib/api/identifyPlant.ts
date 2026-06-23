import { getSupabaseClient } from "@/lib/supabase";
import type {
  IdentifyPlantFunctionRequest,
  IdentifyPlantResponse
} from "@/types/identifyPlant";

export type {
  DiagnosePlantRequest,
  IdentifyPlantFunctionRequest,
  IdentifyPlantRequest,
  IdentifyPlantResponse
} from "@/types/identifyPlant";

export async function identifyPlant(input: IdentifyPlantFunctionRequest) {
  const body = {
    ...input,
    scan_type: input.scanType,
    client_request_id: input.clientRequestId
  };

  if ("speciesContext" in input) {
    Object.assign(body, {
      species_context: input.speciesContext
    });
  }

  const { data, error } = await getSupabaseClient().functions.invoke<IdentifyPlantResponse>(
    "identify-plant",
    {
      body
    }
  );

  if (error) {
    // Non-2xx responses surface as FunctionsHttpError with the structured
    // error payload still on the response — recover it so limit/rate codes
    // reach the UI instead of a generic message.
    const structured = await parseFunctionErrorBody(error);

    if (structured) {
      return structured;
    }

    return {
      ok: false,
      error: {
        code: "function_error",
        message:
          error.message ||
          "Plant identification is unavailable right now. Please try again."
      }
    } satisfies IdentifyPlantResponse;
  }

  if (!data) {
    return {
      ok: false,
      error: {
        code: "empty_response",
        message: "The identify-plant function returned an empty response."
      }
    } satisfies IdentifyPlantResponse;
  }

  return data;
}

async function parseFunctionErrorBody(
  error: unknown
): Promise<IdentifyPlantResponse | null> {
  const context =
    typeof error === "object" && error !== null && "context" in error
      ? (error as { context: unknown }).context
      : null;

  if (!(context instanceof Response)) {
    return null;
  }

  try {
    const payload = (await context.clone().json()) as IdentifyPlantResponse;

    if (payload && payload.ok === false && payload.error?.message) {
      return payload;
    }
  } catch {
    // Body was not the function's JSON error shape; fall through.
  }

  return null;
}
