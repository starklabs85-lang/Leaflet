import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2";

import { handleProductionHealth } from "./handler.ts";

Deno.serve((request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  return handleProductionHealth(request, {
    databaseHealthy: async () => {
      if (!supabaseUrl || !serviceRoleKey) {
        return false;
      }

      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false }
      });
      const { data, error } = await adminClient.rpc("fernly_production_health");
      return !error && data === true;
    }
  });
});
