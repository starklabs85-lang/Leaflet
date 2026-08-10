import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2";

import { parseClientIncidentInput } from "../_shared/productionPaging.ts";
import { reportTrustedProductionIncident } from "../_shared/productionPagingServer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function getBearerToken(req: Request) {
  const value = req.headers.get("Authorization");

  return value?.startsWith("Bearer ") ? value.slice("Bearer ".length).trim() : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, code: "method_not_allowed" }, 405);
  }

  const token = getBearerToken(req);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!token || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ ok: false, code: "auth_required" }, 401);
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, code: "invalid_incident" }, 400);
  }

  const parsed = parseClientIncidentInput(body);

  if (!parsed.ok) {
    return jsonResponse({ ok: false, code: parsed.code }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false }
  });
  const {
    data: { user },
    error: userError
  } = await userClient.auth.getUser(token);

  if (userError || !user) {
    return jsonResponse({ ok: false, code: "auth_required" }, 401);
  }

  const state = await reportTrustedProductionIncident({
    adminClient: createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    }),
    ...parsed.value,
    principalId: user.id
  });

  return jsonResponse({ ok: state !== "error", state }, state === "error" ? 503 : 202);
});
