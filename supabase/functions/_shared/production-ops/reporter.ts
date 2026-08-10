import { dispatchReservation } from "./delivery.ts";
import { reserveProductionIncident, type PagingRpcClient } from "./reservation.ts";
import {
  INCIDENT_CODES,
  type IncidentCategory,
  type IncidentCode,
  type IncidentInput
} from "./types.ts";

type Fetcher = (request: Request) => Promise<Response>;

export type ReporterDependencies = {
  client: PagingRpcClient;
  provider: { url: string; hmacSecret: string } | null;
  jira: { url: string } | null;
  fetcher: Fetcher;
  now: () => Date;
  randomBytes: (length: number) => Uint8Array;
  sleep: (milliseconds: number) => Promise<void>;
  timeoutMs: number;
  waitUntil?: (task: Promise<unknown>) => void;
};

function hex(bytes: Uint8Array) {
  if (bytes.length !== 16) {
    throw new Error("production_ops_unavailable");
  }

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isApprovedPair(category: IncidentCategory, code: IncidentCode) {
  return (INCIDENT_CODES[category] as readonly string[]).includes(code);
}

export async function reportOperationalFailure(
  dependencies: ReporterDependencies,
  category: IncidentCategory,
  code: IncidentCode
) {
  if (!isApprovedPair(category, code) || category === "production_canary") {
    return;
  }

  const input: IncidentInput = {
    appId: "fernly",
    environment: "production",
    category,
    code,
    severity: "critical",
    occurredAt: dependencies.now().toISOString(),
    nonce: hex(dependencies.randomBytes(16)),
    idempotencyKey: hex(dependencies.randomBytes(16))
  };
  const providerConfigured = dependencies.provider !== null;
  const jiraConfigured = dependencies.jira !== null;
  const reservation = await reserveProductionIncident(dependencies.client, input, {
    providerConfigured,
    jiraConfigured
  });

  await dispatchReservation(
    dependencies.client,
    dependencies.fetcher,
    input,
    reservation,
    {
      provider: dependencies.provider,
      jira: dependencies.jira
    },
    {
      now: dependencies.now,
      timeoutMs: dependencies.timeoutMs,
      sleep: dependencies.sleep
    }
  );
}

export function reportOperationalFailureSafely(
  dependencies: ReporterDependencies,
  category: IncidentCategory,
  code: IncidentCode
) {
  const task = reportOperationalFailure(dependencies, category, code).catch(() => undefined);

  if (dependencies.waitUntil) {
    try {
      dependencies.waitUntil(task);
      return;
    } catch {
      // The reporting task remains independently guarded below.
    }
  }

  void task;
}
