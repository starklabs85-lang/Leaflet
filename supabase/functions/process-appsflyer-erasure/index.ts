import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2";

const APPSFLYER_APP_ID = "id6775880316";
const APPSFLYER_OPENDSR_URL =
  "https://hq1.appsflyer.com/api/gdpr/v1/opendsr_requests";
const BATCH_SIZE = 25;
const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;
const ACTIVE_STATUSES = [
  "queued",
  "retry",
  "submitted",
  "pending",
  "in_progress"
] as const;

type ErasureRequest = {
  id: string;
  subject_request_id: string;
  customer_user_id: string | null;
  appsflyer_uid: string | null;
  status: (typeof ACTIVE_STATUSES)[number];
  attempt_count: number;
  requested_at: string;
  deadline_at: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function nextAttemptDate(attemptCount: number) {
  const hours = Math.min(2 ** Math.max(attemptCount, 0), 24);

  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

type ServiceRoleClaims = {
  ref?: unknown;
  role?: unknown;
};

/**
 * `verify_jwt = true` validates the signature before this handler runs. This
 * check narrows that trusted token to Fernly's service role without coupling
 * the scheduler to the exact value of a rotatable legacy service-role JWT.
 */
function isFernlyServiceRoleRequest(req: Request, supabaseUrl: string) {
  const authorization = req.headers.get("Authorization");
  const token = authorization?.match(/^Bearer ([^.]+\.[^.]+\.[^.]+)$/)?.[1];

  if (!token) {
    return false;
  }

  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const claims = JSON.parse(atob(padded)) as ServiceRoleClaims;
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];

    return claims.role === "service_role" && claims.ref === projectRef;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const appsFlyerToken =
    Deno.env.get("APPSFLYER_OPENDSR_API_TOKEN") ?? "";

  if (
    !serviceRoleKey ||
    !isFernlyServiceRoleRequest(req, supabaseUrl)
  ) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  if (!supabaseUrl || !appsFlyerToken) {
    return jsonResponse({ ok: false, error: "server_not_configured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin
    .from("appsflyer_erasure_requests")
    .select(
      "id, subject_request_id, customer_user_id, appsflyer_uid, status, attempt_count, requested_at, deadline_at"
    )
    .in("status", [...ACTIVE_STATUSES])
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(BATCH_SIZE)
    .returns<ErasureRequest[]>();

  if (error) {
    return jsonResponse({ ok: false, error: "queue_read_failed" }, 500);
  }

  let completed = 0;
  let processed = 0;
  let retried = 0;

  for (const request of data ?? []) {
    processed += 1;

    try {
      if (request.status === "queued" || request.status === "retry") {
        await submitErasure(request, appsFlyerToken, admin);
      } else {
        const didComplete = await refreshErasure(
          request,
          appsFlyerToken,
          admin
        );

        if (didComplete) {
          completed += 1;
        }
      }
    } catch {
      retried += 1;
      const attempts = request.attempt_count + 1;
      await admin
        .from("appsflyer_erasure_requests")
        .update({
          attempt_count: attempts,
          last_error: "AppsFlyer OpenDSR delivery failed; retry scheduled.",
          next_attempt_at: nextAttemptDate(attempts),
          status: "retry"
        })
        .eq("id", request.id);
    }

    if (
      request.status !== "completed" &&
      Date.parse(request.deadline_at) - Date.now() <= 24 * 60 * 60 * 1000
    ) {
      // Do not log provider identifiers. This structured marker is intended
      // for a Supabase log alert before the ten-day AppsFlyer SLA.
      console.error("appsflyer_opendsr_deadline_at_risk");
    }
  }

  return jsonResponse({ ok: true, processed, completed, retried });
});

async function submitErasure(
  request: ErasureRequest,
  token: string,
  admin: ReturnType<typeof createClient>
) {
  const identity = request.appsflyer_uid
    ? {
        identity_type: "appsflyer_id",
        identity_value: request.appsflyer_uid,
        identity_format: "raw"
      }
    : request.customer_user_id
      ? {
          identity_type: "customer_user_id",
          identity_value: request.customer_user_id,
          identity_format: "raw"
        }
      : null;

  if (!identity) {
    await admin
      .from("appsflyer_erasure_requests")
      .update({
        last_error: "No provider identity remained for submission.",
        status: "failed"
      })
      .eq("id", request.id);
    return;
  }

  const response = await fetch(APPSFLYER_OPENDSR_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      api_version: "0.1",
      platform: "ios",
      property_id: APPSFLYER_APP_ID,
      subject_identities: [identity],
      subject_request_id: request.subject_request_id,
      subject_request_type: "erasure",
      submitted_time: request.requested_at
    })
  });

  if (response.status !== 201) {
    if (response.status === 400) {
      const existing = await fetchProviderStatus(
        request.subject_request_id,
        token
      );

      if (existing) {
        await applyProviderStatus(request.id, existing, admin);
        return;
      }
    }

    throw new Error(`AppsFlyer OpenDSR POST returned ${response.status}.`);
  }

  await admin
    .from("appsflyer_erasure_requests")
    .update({
      attempt_count: request.attempt_count + 1,
      last_error: null,
      next_attempt_at: new Date(Date.now() + POLL_INTERVAL_MS).toISOString(),
      provider_status: "pending",
      status: "pending",
      submitted_at: new Date().toISOString()
    })
    .eq("id", request.id);
}

async function refreshErasure(
  request: ErasureRequest,
  token: string,
  admin: ReturnType<typeof createClient>
) {
  const status = await fetchProviderStatus(request.subject_request_id, token);

  if (!status) {
    throw new Error("AppsFlyer OpenDSR status was unavailable.");
  }

  return applyProviderStatus(request.id, status, admin);
}

async function fetchProviderStatus(subjectRequestId: string, token: string) {
  const response = await fetch(
    `${APPSFLYER_OPENDSR_URL}/${encodeURIComponent(subjectRequestId)}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    return null;
  }

  const body = (await response.json().catch(() => null)) as {
    request_status?: unknown;
  } | null;
  const status = body?.request_status;

  return status === "pending" ||
    status === "in_progress" ||
    status === "completed" ||
    status === "canceled"
    ? status
    : null;
}

async function applyProviderStatus(
  requestId: string,
  providerStatus: "canceled" | "completed" | "in_progress" | "pending",
  admin: ReturnType<typeof createClient>
) {
  if (providerStatus === "completed") {
    await admin
      .from("appsflyer_erasure_requests")
      .update({
        appsflyer_uid: null,
        completed_at: new Date().toISOString(),
        customer_user_id: null,
        last_error: null,
        provider_status: providerStatus,
        status: "completed"
      })
      .eq("id", requestId);
    return true;
  }

  if (providerStatus === "canceled") {
    await admin
      .from("appsflyer_erasure_requests")
      .update({
        last_error: "AppsFlyer canceled the OpenDSR request.",
        provider_status: providerStatus,
        status: "failed"
      })
      .eq("id", requestId);
    return false;
  }

  await admin
    .from("appsflyer_erasure_requests")
    .update({
      last_error: null,
      next_attempt_at: new Date(Date.now() + POLL_INTERVAL_MS).toISOString(),
      provider_status: providerStatus,
      status: providerStatus
    })
    .eq("id", requestId);
  return false;
}
