import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const providerPath = path.join(
  process.cwd(),
  "ops/apps-script/fernly-production-alerts/Code.gs"
);
const secret = "0123456789abcdef0123456789abcdef";

type Mail = { to: string; subject: string; body: string };

function createHarness({ failOnceTo }: { failOnceTo?: string } = {}) {
  const properties = new Map<string, string>([["FERNLY_PROVIDER_HMAC_SECRET", secret]]);
  const messages: Mail[] = [];
  let failedOnce = false;
  const code = readFileSync(providerPath, "utf8");
  const context = {
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput(content: string) {
        return {
          content,
          getContent() {
            return this.content;
          },
          setMimeType() {
            return this;
          }
        };
      }
    },
    LockService: {
      getScriptLock: () => ({
        releaseLock() {},
        waitLock() {}
      })
    },
    MailApp: {
      sendEmail(to: string, subject: string, body: string) {
        if (to === failOnceTo && !failedOnce) {
          failedOnce = true;
          throw new Error("mail_unavailable");
        }

        messages.push({ to, subject, body });
      }
    },
    PropertiesService: {
      getScriptProperties: () => ({
        deleteProperty(key: string) {
          properties.delete(key);
        },
        getProperties() {
          return Object.fromEntries(properties);
        },
        getProperty(key: string) {
          return properties.get(key) ?? null;
        },
        setProperty(key: string, value: string) {
          properties.set(key, value);
        }
      })
    },
    Utilities: {
      Charset: { UTF_8: "UTF-8" },
      computeHmacSha256Signature(value: string, key: string) {
        return Array.from(createHmac("sha256", key).update(value).digest());
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(code, context, { filename: providerPath });

  return {
    messages,
    doPost: (context as typeof context & { doPost: (event: unknown) => { getContent(): string } })
      .doPost
  };
}

function providerPayload(suffix: string) {
  return {
    appId: "fernly",
    environment: "production",
    category: "production_canary",
    code: "controlled_test",
    severity: "critical",
    dedupeLabel: `fernly-incident-${suffix}`,
    occurrenceCount: 1,
    deliveryKey: `fernly-incident-${suffix}`,
    occurredAt: new Date().toISOString()
  };
}

function signedEvent(payload: ReturnType<typeof providerPayload>, overrides = {}) {
  const timestamp = new Date().toISOString();
  const nonce = payload.deliveryKey;
  const canonicalPayload = JSON.stringify(payload);
  const signature = `sha256=${createHmac("sha256", secret)
    .update(`${timestamp}.${nonce}.${canonicalPayload}`)
    .digest("hex")}`;
  const body = { nonce, payload, signature, timestamp, ...overrides };

  return {
    postData: {
      contents: JSON.stringify(body),
      length: JSON.stringify(body).length,
      type: "application/json"
    }
  };
}

function result(output: { getContent(): string }) {
  return JSON.parse(output.getContent()) as { status: string };
}

test("valid HMAC sends one fixed page to each approved inbox", () => {
  const harness = createHarness();
  const payload = providerPayload("0123456789abcdef01234567");

  assert.deepEqual(result(harness.doPost(signedEvent(payload))), { status: "sent" });
  assert.deepEqual(
    harness.messages.map((message) => message.to),
    ["nalin.aditya@gmail.com", "starklabs2026@gmail.com"]
  );
  assert.equal(harness.messages.length, 2);
  assert.equal(harness.messages.every((message) => !message.body.includes(secret)), true);
});

test("exact replay sends no additional email", () => {
  const harness = createHarness();
  const event = signedEvent(providerPayload("1123456789abcdef01234567"));

  assert.deepEqual(result(harness.doPost(event)), { status: "sent" });
  assert.deepEqual(result(harness.doPost(event)), { status: "duplicate" });
  assert.equal(harness.messages.length, 2);
});

test("a retry after partial delivery sends only the missing recipient", () => {
  const harness = createHarness({ failOnceTo: "starklabs2026@gmail.com" });
  const event = signedEvent(providerPayload("4123456789abcdef01234567"));

  assert.throws(() => harness.doPost(event), /mail_unavailable/);
  assert.deepEqual(harness.messages.map((message) => message.to), ["nalin.aditya@gmail.com"]);
  assert.deepEqual(result(harness.doPost(event)), { status: "sent" });
  assert.deepEqual(
    harness.messages.map((message) => message.to),
    ["nalin.aditya@gmail.com", "starklabs2026@gmail.com"]
  );
  assert.deepEqual(result(harness.doPost(event)), { status: "duplicate" });
  assert.equal(harness.messages.length, 2);
});

test("wrong HMAC sends no email", () => {
  const harness = createHarness();
  const event = signedEvent(providerPayload("2123456789abcdef01234567"), {
    signature: `sha256=${"0".repeat(64)}`
  });

  assert.deepEqual(result(harness.doPost(event)), { status: "unauthorized" });
  assert.equal(harness.messages.length, 0);
});

test("an unrecognized payload field is rejected before email", () => {
  const harness = createHarness();
  const payload = { ...providerPayload("3123456789abcdef01234567"), plantContent: "forbidden" };
  const event = signedEvent(payload);

  assert.deepEqual(result(harness.doPost(event)), { status: "malformed" });
  assert.equal(harness.messages.length, 0);
});
