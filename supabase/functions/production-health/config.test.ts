import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync(new URL("../../config.toml", import.meta.url), "utf8");

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
