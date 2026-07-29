import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { runAccountDeletionServerFlow } from "./flow.ts";

type StorageEntry = {
  id: string | null;
  metadata: Record<string, unknown> | null;
  name: string;
};

const STORAGE_BUCKETS = ["plant-photos", "scan-uploads"] as const;
const STORAGE_PAGE_SIZE = 1000;
const STORAGE_REMOVE_BATCH_SIZE = 1000;

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

function getStorageEntry(value: unknown): StorageEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const metadata = record.metadata;

  return {
    id: typeof record.id === "string" ? record.id : null,
    metadata:
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : null,
    name: typeof record.name === "string" ? record.name : ""
  };
}

function isFolder(entry: StorageEntry) {
  return entry.id === null && entry.metadata === null;
}

async function listStorageEntries(
  adminClient: SupabaseClient,
  bucket: string,
  prefix: string,
  offset: number
) {
  const { data, error } = await adminClient.storage.from(bucket).list(prefix, {
    limit: STORAGE_PAGE_SIZE,
    offset,
    sortBy: { column: "name", order: "asc" }
  });

  if (error) {
    throw new Error(`Storage list failed for ${bucket}/${prefix}: ${error.message}`);
  }

  return (data ?? [])
    .map(getStorageEntry)
    .filter((entry): entry is StorageEntry => Boolean(entry?.name));
}

async function collectStorageObjectPaths(
  adminClient: SupabaseClient,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;

  while (true) {
    const entries = await listStorageEntries(adminClient, bucket, prefix, offset);

    for (const entry of entries) {
      const path = `${prefix}/${entry.name}`;

      if (isFolder(entry)) {
        paths.push(...(await collectStorageObjectPaths(adminClient, bucket, path)));
      } else {
        paths.push(path);
      }
    }

    if (entries.length < STORAGE_PAGE_SIZE) {
      break;
    }

    offset += entries.length;
  }

  return paths;
}

async function removeStorageObjects(
  adminClient: SupabaseClient,
  bucket: string,
  paths: string[]
) {
  for (let index = 0; index < paths.length; index += STORAGE_REMOVE_BATCH_SIZE) {
    const batch = paths.slice(index, index + STORAGE_REMOVE_BATCH_SIZE);
    const { error } = await adminClient.storage.from(bucket).remove(batch);

    if (error) {
      throw new Error(`Storage delete failed for ${bucket}: ${error.message}`);
    }
  }
}

async function deleteUserStorageFolders(adminClient: SupabaseClient, userId: string) {
  for (const bucket of STORAGE_BUCKETS) {
    const paths = await collectStorageObjectPaths(adminClient, bucket, userId);

    if (paths.length > 0) {
      await removeStorageObjects(adminClient, bucket, paths);
    }
  }
}

function normalizeAppsFlyerUid(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length <= 200 && /^[A-Za-z0-9._:-]+$/.test(trimmed)
    ? trimmed
    : null;
}

async function ensureErasureRequestHeld(
  adminClient: SupabaseClient,
  userId: string,
  appsflyerUid: string | null
) {
  const { data: existing, error: readError } = await adminClient
    .from("appsflyer_erasure_requests")
    .select("id, appsflyer_uid")
    .eq("customer_user_id", userId)
    .maybeSingle();

  if (readError) {
    throw new Error(`queue_create_failed:${readError.message}`);
  }

  if (existing) {
    if (!existing.appsflyer_uid && appsflyerUid) {
      const { error } = await adminClient
        .from("appsflyer_erasure_requests")
        .update({ appsflyer_uid: appsflyerUid })
        .eq("id", existing.id);

      if (error) {
        throw new Error(`queue_create_failed:${error.message}`);
      }
    }

    return existing.id as string;
  }

  const { data, error } = await adminClient
    .from("appsflyer_erasure_requests")
    .insert({
      appsflyer_uid: appsflyerUid,
      customer_user_id: userId,
      status: "held"
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`queue_create_failed:${error?.message ?? "no row returned"}`);
  }

  return data.id as string;
}

async function releaseErasureRequest(
  adminClient: SupabaseClient,
  requestId: string
) {
  const { error } = await adminClient
    .from("appsflyer_erasure_requests")
    .update({
      next_attempt_at: new Date().toISOString(),
      status: "queued"
    })
    .eq("id", requestId)
    .eq("status", "held");

  if (error) {
    throw new Error(`queue_release_failed:${error.message}`);
  }
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
          message: "Use POST to delete an account."
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "server_not_configured",
          message: "Account deletion is not configured yet."
        }
      },
      500
    );
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: authError
  } = await userClient.auth.getUser(token);

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

  const body = await req.json().catch(() => ({}));
  const appsflyerUid = normalizeAppsFlyerUid(
    body && typeof body === "object"
      ? (body as Record<string, unknown>).appsflyerUid
      : null
  );
  let erasureRequestId = "";

  try {
    await runAccountDeletionServerFlow({
      enqueueErasureHeld: async () => {
        erasureRequestId = await ensureErasureRequestHeld(
          adminClient,
          user.id,
          appsflyerUid
        );
      },
      deleteStorage: () => deleteUserStorageFolders(adminClient, user.id),
      releaseErasure: () =>
        releaseErasureRequest(adminClient, erasureRequestId),
      revokeSessions: async () => {
        const { error } = await adminClient.auth.admin.signOut(token, "global");

        if (error) {
          console.warn("delete-account session revoke failed", {
            message: error.message
          });
        }
      },
      deleteUser: async () => {
        const { error } = await adminClient.auth.admin.deleteUser(
          user.id,
          false
        );

        if (error) {
          throw new Error(`delete_user_failed:${error.message}`);
        }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.startsWith("queue_create_failed")
      ? "erasure_queue_failed"
      : message.startsWith("queue_release_failed")
        ? "erasure_queue_release_failed"
        : message.startsWith("delete_user_failed")
          ? "delete_user_failed"
          : "storage_cleanup_failed";
    const publicMessage =
      code === "storage_cleanup_failed"
        ? "Your account could not be deleted because saved files could not be removed."
        : code === "delete_user_failed"
          ? "Your account could not be deleted. Please try again."
          : "Your privacy deletion request could not be secured. Please try again.";

    return jsonResponse(
      {
        ok: false,
        error: {
          code,
          message: publicMessage
        }
      },
      500
    );
  }

  return jsonResponse({ ok: true });
});
