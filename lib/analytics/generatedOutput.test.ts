import assert from "node:assert/strict";
import test from "node:test";

import { generatedOutputMatches } from "../../scripts/generatedOutput";

test("generated output comparison ignores checkout line-ending differences", () => {
  assert.equal(
    generatedOutputMatches(
      "first line\r\nsecond line\r\n",
      "first line\nsecond line\n"
    ),
    true
  );
});

test("generated output comparison still detects semantic changes", () => {
  assert.equal(
    generatedOutputMatches(
      "first line\r\nold value\r\n",
      "first line\nnew value\n"
    ),
    false
  );
});
