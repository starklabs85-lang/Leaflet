import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync(new URL("../../config.toml", import.meta.url), "utf8");
const hardeningMigration = readFileSync(
  new URL("../../migrations/20260811090000_harden_fernly_production_paging.sql", import.meta.url),
  "utf8"
);

test("public health and custom-HMAC ingress deploy without Supabase JWT enforcement", () => {
  assert.match(
    config,
    /\[functions\.production-health\]\s+verify_jwt = false/
  );
  assert.match(
    config,
    /\[functions\.production-incident\]\s+verify_jwt = false/
  );
});

test("hardening migration resolves pgcrypto from the Supabase extensions schema", () => {
  assert.equal(hardeningMigration.match(/extensions\.digest\(/g)?.length, 2);
  assert.doesNotMatch(hardeningMigration, /(?<!\.)\bdigest\(/);
});
