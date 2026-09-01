import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import config from "../app.config";

test("the configured iOS release icon exists in the build archive", () => {
  const configuredIcons = [config.icon, config.ios?.icon];

  for (const icon of configuredIcons) {
    assert.equal(typeof icon, "string");
    assert.equal(existsSync(resolve(process.cwd(), icon as string)), true);
  }
});

test("the iOS release archive uses the approved Fernly leaf-scan logo", () => {
  const icon = readFileSync(resolve(process.cwd(), config.ios?.icon as string));

  assert.equal(
    createHash("sha256").update(icon).digest("hex"),
    "077be97c76a65f04bccca83084d2233c2c1aac509eaf8a8418e670854f0212f6"
  );
});
