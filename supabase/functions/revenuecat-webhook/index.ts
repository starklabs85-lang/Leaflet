import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2";
import { reportEdgeOperationalFailure } from "../_shared/production-ops/edgeReporter.ts";
import type { PagingRpcClient } from "../_shared/production-ops/reservation.ts";

/**
 * RevenueCat → Supabase entitlement sync (Phase 13 §7).
 *
 * RevenueCat posts subscription lifecycle events here; this function is the
 * ONLY writer of the `subscriptions` table. The client reads entitlement live
 * from the RevenueCat SDK and may read (never write) its own row. Requests
 * must carry the shared Authorization secret configured on the RevenueCat
 * webhook integration (`REVENUECAT_WEBHOOK_SECRET`, server-only).
 */

type RevenueCatEvent = {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  entitlement_ids?: string[] | null;
  product_id?: string;
  store?: string;
  environment?: string;
  expiration_at_ms?: number | null;
  transaction_id?: string | null;
  transferred_to?: string[] | null;
  transferred_from?: string[] | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Events that keep (or grant) premium access. CANCELLATION only turns off
// auto-renew — access continues until EXPIRATION, so it stays premium here.
const PREMIUM_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "CANCELLATION",
  "PRODUCT_CHANGE",
  "BILLING_ISSUE",
  "SUBSCRIPTION_EXTENDED"
]);

const FREE_EVENTS = new Set(["EXPIRATION"]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function normalizeSecret(value: string | null) {
  if (!value) {
    return "";
  }

  return value.startsWith("Bearer ") ? value.slice("Bearer ".length) : value;
}

function resolveSupabaseUserId(event: RevenueCatEvent) {
  const candidates = [
    event.app_user_id,
    event.original_app_user_id,
    ...(event.aliases ?? [])
  ];

  for (const candidate of candidates) {
    if (candidate && UUID_PATTERN.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolvePlatform(store: string | undefined) {
  if (store === "APP_STORE" || store === "MAC_APP_STORE") {
    return "ios";
  }

  if (store === "PLAY_STORE" || store === "AMAZON") {
    return "android";
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const adminClient = supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : null;
  const expectedSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET") ?? "";

  if (!expectedSecret || !adminClient) {
    if (adminClient) {
      reportEdgeOperationalFailure(
        adminClient as unknown as PagingRpcClient,
        "revenuecat_webhook_failed",
        "webhook_not_configured"
      );
    }

    return jsonResponse({ ok: false, error: "webhook_not_configured" }, 500);
  }

  const providedSecret = normalizeSecret(req.headers.get("Authorization"));

  if (providedSecret !== expectedSecret) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  let event: RevenueCatEvent;

  try {
    const payload = await req.json();

    event = (payload?.event ?? {}) as RevenueCatEvent;
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const eventType = event.type ?? "UNKNOWN";

  // TEST fires from the RevenueCat dashboard's "send test event" button.
  if (eventType === "TEST") {
    return jsonResponse({ ok: true, handled: "test_event" });
  }

  const isPremiumEvent = PREMIUM_EVENTS.has(eventType);
  const isFreeEvent = FREE_EVENTS.has(eventType);

  if (!isPremiumEvent && !isFreeEvent) {
    // Unhandled types (TRANSFER, INVOICE_ISSUANCE, ...) are acknowledged so
    // RevenueCat does not retry them forever.
    return jsonResponse({ ok: true, handled: "ignored", type: eventType });
  }

  const userId = resolveSupabaseUserId(event);

  if (!userId) {
    // Purchase made before sign-in with no Supabase alias yet; the SDK merge
    // on logIn will produce follow-up events carrying the real user id.
    return jsonResponse({ ok: true, handled: "no_supabase_user", type: eventType });
  }

  const { error } = await adminClient.from("subscriptions").upsert(
    {
      user_id: userId,
      plan: isPremiumEvent ? "premium" : "free",
      entitlement: event.entitlement_ids?.[0] ?? "premium",
      platform: resolvePlatform(event.store),
      store_transaction_id: event.transaction_id ?? null,
      rc_app_user_id: event.app_user_id ?? null,
      expires_at: event.expiration_at_ms
        ? new Date(event.expiration_at_ms).toISOString()
        : null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) {
    // Non-2xx so RevenueCat retries (e.g. transient DB issue). A user id that
    // fails the FK would also land here — RevenueCat's bounded retries stop
    // eventually, and the durable state reconciles on the next event.
    console.error("revenuecat-webhook upsert failed", { code: "upsert_failed" });
    reportEdgeOperationalFailure(
      adminClient as unknown as PagingRpcClient,
      "revenuecat_webhook_failed",
      "upsert_failed"
    );

    return jsonResponse({ ok: false, error: "upsert_failed" }, 500);
  }

  return jsonResponse({ ok: true, handled: eventType });
});
