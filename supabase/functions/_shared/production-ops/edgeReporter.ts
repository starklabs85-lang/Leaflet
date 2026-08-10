import type { PagingRpcClient } from "./reservation.ts";
import { reportOperationalFailureSafely } from "./reporter.ts";
import type { IncidentCategory, IncidentCode } from "./types.ts";

type EdgeGlobals = typeof globalThis & {
  Deno?: { env: { get: (name: string) => string | undefined } };
  EdgeRuntime?: { waitUntil?: (task: Promise<unknown>) => void };
};

export function reportEdgeOperationalFailure(
  client: PagingRpcClient,
  category: IncidentCategory,
  code: IncidentCode
) {
  const runtime = globalThis as EdgeGlobals;
  const providerUrl = runtime.Deno?.env.get("FERNLY_PAGING_PROVIDER_URL")?.trim() ?? "";
  const providerHmacSecret =
    runtime.Deno?.env.get("FERNLY_PAGING_PROVIDER_HMAC_SECRET")?.trim() ?? "";
  const jiraUrl = runtime.Deno?.env.get("FERNLY_JIRA_WEBHOOK_URL")?.trim() ?? "";

  reportOperationalFailureSafely(
    {
      client,
      provider:
        providerUrl && providerHmacSecret
          ? { url: providerUrl, hmacSecret: providerHmacSecret }
          : null,
      jira: jiraUrl ? { url: jiraUrl } : null,
      fetcher: (request) => fetch(request),
      now: () => new Date(),
      randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
      sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
      timeoutMs: 5_000,
      waitUntil: runtime.EdgeRuntime?.waitUntil
    },
    category,
    code
  );
}
