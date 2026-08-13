import assert from "node:assert/strict";
import test from "node:test";

import { createFirstPartyConsentAdapter } from "./firstPartyConsent";

type MemoryStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  values: Map<string, string>;
};

function createMemoryStorage(initialValue?: string): MemoryStorage {
  const values = new Map<string, string>();

  if (initialValue) {
    values.set("fernly.measurement-consent", initialValue);
  }

  return {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    values
  };
}

test("a new installation requires an explicit measurement choice", async () => {
  const adapter = createFirstPartyConsentAdapter({
    now: () => "2026-07-30T10:00:00.000Z",
    policyVersion: "2026-07-30",
    requestChoice: async () => "granted",
    storage: createMemoryStorage()
  });

  assert.equal(await adapter.initialize(), "required");
});

test("a current stored choice restores measurement without prompting", async () => {
  const storage = createMemoryStorage(
    JSON.stringify({
      choice: "granted",
      policyVersion: "2026-07-30",
      updatedAt: "2026-07-30T09:00:00.000Z"
    })
  );
  let promptCount = 0;
  const adapter = createFirstPartyConsentAdapter({
    now: () => "2026-07-30T10:00:00.000Z",
    policyVersion: "2026-07-30",
    requestChoice: async () => {
      promptCount += 1;
      return "denied";
    },
    storage
  });

  assert.equal(await adapter.initialize(), "granted");
  assert.equal(promptCount, 0);
});

test("a changed policy version requires a fresh choice", async () => {
  const adapter = createFirstPartyConsentAdapter({
    now: () => "2026-07-30T10:00:00.000Z",
    policyVersion: "2026-07-30",
    requestChoice: async () => "granted",
    storage: createMemoryStorage(
      JSON.stringify({
        choice: "granted",
        policyVersion: "2026-07-29",
        updatedAt: "2026-07-29T09:00:00.000Z"
      })
    )
  });

  assert.equal(await adapter.initialize(), "required");
});

test("the ATT policy revision re-prompts users who accepted the no-ATT policy", async () => {
  const adapter = createFirstPartyConsentAdapter({
    now: () => "2026-08-13T10:00:00.000Z",
    requestChoice: async () => "granted",
    storage: createMemoryStorage(
      JSON.stringify({
        choice: "granted",
        policyVersion: "2026-07-30",
        updatedAt: "2026-07-30T09:00:00.000Z"
      })
    )
  });

  assert.equal(await adapter.initialize(), "required");
});

test("the first-layer decision is durably recorded before it is applied", async () => {
  const storage = createMemoryStorage();
  const adapter = createFirstPartyConsentAdapter({
    now: () => "2026-07-30T10:00:00.000Z",
    policyVersion: "2026-07-30",
    requestChoice: async (request) => {
      assert.deepEqual(request, {
        currentChoice: null,
        mode: "initial"
      });
      return "denied";
    },
    storage
  });

  assert.equal(await adapter.initialize(), "required");
  assert.equal(await adapter.applyConsent(), "denied");
  assert.deepEqual(
    JSON.parse(storage.values.get("fernly.measurement-consent") ?? ""),
    {
      choice: "denied",
      policyVersion: "2026-07-30",
      updatedAt: "2026-07-30T10:00:00.000Z"
    }
  );
});

test("privacy choices can withdraw and persist an existing grant", async () => {
  const storage = createMemoryStorage(
    JSON.stringify({
      choice: "granted",
      policyVersion: "2026-07-30",
      updatedAt: "2026-07-30T09:00:00.000Z"
    })
  );
  const adapter = createFirstPartyConsentAdapter({
    now: () => "2026-07-30T10:00:00.000Z",
    policyVersion: "2026-07-30",
    requestChoice: async (request) => {
      assert.deepEqual(request, {
        currentChoice: "granted",
        mode: "settings"
      });
      return "denied";
    },
    storage
  });

  assert.equal(await adapter.initialize(), "granted");
  assert.equal(await adapter.showPrivacyChoices(), "denied");
  assert.equal(await adapter.applyConsent(), "denied");
});
