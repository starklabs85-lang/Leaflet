import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import {
  createPendingDeepLink,
  consumePendingDeepLink,
  parseOneLinkPayload
} from "./oneLink";

test("parses only the allowlisted OneLink destinations", () => {
  deepEqual(parseOneLinkPayload({ deep_link_value: "home" }), {
    kind: "home"
  });
  deepEqual(
    parseOneLinkPayload({
      data: {
        deep_link_sub1: "diagnose",
        deep_link_value: "scan"
      }
    }),
    { kind: "scan", mode: "diagnose" }
  );
  deepEqual(parseOneLinkPayload({ deep_link_value: "premium" }), {
    kind: "premium"
  });
  deepEqual(parseOneLinkPayload({ deep_link_value: "activation" }), {
    kind: "activation"
  });
});

test("rejects arbitrary routes, URLs, invalid scan modes, and oversized values", () => {
  equal(parseOneLinkPayload({ deep_link_value: "/admin" }), null);
  equal(
    parseOneLinkPayload({ deep_link_value: "https://example.com/private" }),
    null
  );
  equal(
    parseOneLinkPayload({
      deep_link_sub1: "treat",
      deep_link_value: "scan"
    }),
    null
  );
  equal(parseOneLinkPayload({ deep_link_value: "x".repeat(101) }), null);
});

test("pending deep links are consumed once and expire after 24 hours", () => {
  const now = Date.parse("2026-07-29T00:00:00.000Z");
  const pending = createPendingDeepLink({ kind: "premium" }, now);

  deepEqual(consumePendingDeepLink(pending, now + 86_399_999), {
    intent: { kind: "premium" },
    remaining: null
  });
  deepEqual(consumePendingDeepLink(pending, now + 86_400_000), {
    intent: null,
    remaining: null
  });
  deepEqual(consumePendingDeepLink(null, now), {
    intent: null,
    remaining: null
  });
});
