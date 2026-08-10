import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2";

import { decidePagingState, FERNLY_APP_ID } from "../_shared/productionPaging.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse({ ok: false, code: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, code: "service_unavailable" }, 503);
  }

  try {
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });
    const { data, error } = await adminClient
      .from("production_paging_config")
      .select("enabled, kill_switch")
      .eq("app_id", FERNLY_APP_ID)
      .maybeSingle();

    if (error || !data) {
      return jsonResponse({ ok: false, code: "database_unavailable" }, 503);
    }

    const providerConfigured = Boolean(
      Deno.env.get("FERNLY_PAGING_PROVIDER_URL")?.trim() &&
        Deno.env.get("FERNLY_PAGING_PROVIDER_HMAC_SECRET")?.trim()
    );

    return jsonResponse({
      ok: true,
      app_id: FERNLY_APP_ID,
      paging_state: decidePagingState({
        enabled: data.enabled,
        killSwitch: data.kill_switch,
        providerConfigured
      })
    });
  } catch {
    return jsonResponse({ ok: false, code: "database_unavailable" }, 503);
  }
});
