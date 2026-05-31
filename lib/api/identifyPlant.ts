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
