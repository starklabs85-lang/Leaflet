import { existsSync } from "node:fs";
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
