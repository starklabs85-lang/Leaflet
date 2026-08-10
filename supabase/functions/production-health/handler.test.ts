import assert from "node:assert/strict";
import test from "node:test";

import { handleProductionHealth } from "./handler.ts";

test("healthy response exposes only the fixed Fernly API/database contract", async () => {
  const response = await handleProductionHealth(new Request("https://example.invalid", {
    method: "GET"
  }), {
    databaseHealthy: async () => true
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    appId: "fernly",
    environment: "production",
    status: "ok",
    schemaVersion: 1
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("database failure returns one fixed unavailable response", async () => {
  for (const databaseHealthy of [
    async () => false,
    async () => {
      throw new Error("database table and network details");
    }
  ]) {
    const response = await handleProductionHealth(new Request("https://example.invalid", {
      method: "GET"
    }), { databaseHealthy });

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      appId: "fernly",
      environment: "production",
      status: "unavailable",
      schemaVersion: 1
    });
  }
});

test("health rejects non-GET methods without checking the database", async () => {
  let calls = 0;
  const response = await handleProductionHealth(new Request("https://example.invalid", {
    method: "POST"
  }), {
    databaseHealthy: async () => {
      calls += 1;
      return true;
    }
  });

  assert.equal(response.status, 405);
  assert.deepEqual(await response.json(), {
    appId: "fernly",
    environment: "production",
    status: "method_not_allowed",
    schemaVersion: 1
  });
  assert.equal(calls, 0);
});
