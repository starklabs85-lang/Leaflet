import "react-native-url-polyfill/auto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env, getSupabaseConfigIssue, hasSupabaseConfig } from "@/lib/env";
import { secureStorageAdapter } from "@/lib/secure-storage";
import type { Database } from "@/types/database";

let client: SupabaseClient<Database> | null = null;

export function getSupabaseClient() {
  if (!hasSupabaseConfig()) {
    throw new Error(getSupabaseConfigIssue() ?? "Supabase is not configured.");
  }

  client ??= createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage: secureStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  });

  return client;
}

export async function getSupabaseSessionHealth() {
  if (!hasSupabaseConfig()) {
    return {
      ok: false,
      message: getSupabaseConfigIssue() ?? "Supabase is not configured."
    };
  }

  const { error } = await getSupabaseClient().auth.getSession();

  if (error) {
    return {
      ok: false,
      message: error.message
    };
  }

  return {
    ok: true,
    message: "Supabase client initialized and getSession returned without error."
  };
}
