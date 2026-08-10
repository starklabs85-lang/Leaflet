var FERNLY_APPROVED_RECIPIENTS = [
  "nalin.aditya@gmail.com",
  "starklabs2026@gmail.com"
];
var FERNLY_REPLAY_PREFIX = "FERNLY_PROVIDER_REPLAY_";
var FERNLY_REPLAY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
var FERNLY_TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;
var FERNLY_PAYLOAD_KEYS = [
  "appId",
  "category",
  "code",
  "dedupeLabel",
  "deliveryKey",
  "environment",
  "occurredAt",
  "occurrenceCount",
  "severity"
];
var FERNLY_ENVELOPE_KEYS = ["nonce", "payload", "signature", "timestamp"];
var FERNLY_INCIDENT_CODES = {
  identify_failed: [
    "missing_openai_key",
    "openai_unavailable",
    "validation_failed",
    "scan_cache_unavailable",
    "scan_event_unavailable"
  ],
  account_delete_failed: [
    "erasure_queue_failed",
    "erasure_queue_release_failed",
    "storage_cleanup_failed",
    "delete_user_failed"
  ],
  revenuecat_webhook_failed: ["webhook_not_configured", "upsert_failed"],
  weather_tips_failed: ["weather_unavailable", "plants_unavailable"],
  client_primary_action_failed: ["function_error", "network_unavailable"],
  production_canary: ["controlled_test"]
};

function fernlyJsonStatus_(status) {
  return ContentService.createTextOutput(JSON.stringify({ status: status }))
    .setMimeType(ContentService.MimeType.JSON);
}

function fernlyIsRecord_(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fernlyHasExactKeys_(value, expected) {
  if (!fernlyIsRecord_(value)) {
    return false;
  }

  return Object.keys(value).sort().join("|") === expected.join("|");
}

function fernlyIsExactIso_(value) {
  if (typeof value !== "string") {
    return false;
  }

  var parsed = new Date(value);
  return !isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function fernlyCanonicalPayload_(payload) {
  return {
    appId: payload.appId,
    environment: payload.environment,
    category: payload.category,
    code: payload.code,
    severity: payload.severity,
    dedupeLabel: payload.dedupeLabel,
    occurrenceCount: payload.occurrenceCount,
    deliveryKey: payload.deliveryKey,
    occurredAt: payload.occurredAt
  };
}

function fernlyValidPayload_(payload) {
  if (!fernlyHasExactKeys_(payload, FERNLY_PAYLOAD_KEYS)) {
    return false;
  }

  var codes = FERNLY_INCIDENT_CODES[payload.category];
  return payload.appId === "fernly" &&
    payload.environment === "production" &&
    payload.severity === "critical" &&
    Array.isArray(codes) &&
    codes.indexOf(payload.code) !== -1 &&
    /^fernly-incident-[a-f0-9]{24}$/.test(payload.dedupeLabel) &&
    payload.deliveryKey === payload.dedupeLabel &&
    Number.isInteger(payload.occurrenceCount) &&
    payload.occurrenceCount >= 1 &&
    payload.occurrenceCount <= 2147483647 &&
    fernlyIsExactIso_(payload.occurredAt);
}

function fernlyHex_(bytes) {
  return bytes.map(function (byte) {
    return ((byte + 256) % 256).toString(16).padStart(2, "0");
  }).join("");
}

function fernlyConstantTimeEqual_(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) {
    return false;
  }

  var difference = 0;
  for (var index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function fernlyAuthorized_(envelope, secret, now) {
  if (typeof secret !== "string" || secret.length < 32 ||
      typeof envelope.timestamp !== "string" ||
      typeof envelope.nonce !== "string" ||
      typeof envelope.signature !== "string" ||
      !/^sha256=[a-f0-9]{64}$/.test(envelope.signature) ||
      envelope.nonce !== envelope.payload.deliveryKey ||
      !fernlyIsExactIso_(envelope.timestamp)) {
    return false;
  }

  var timestampMs = new Date(envelope.timestamp).getTime();
  if (Math.abs(now - timestampMs) > FERNLY_TIMESTAMP_WINDOW_MS) {
    return false;
  }

  var canonicalPayload = JSON.stringify(fernlyCanonicalPayload_(envelope.payload));
  var signedValue = envelope.timestamp + "." + envelope.nonce + "." + canonicalPayload;
  var expected = "sha256=" + fernlyHex_(Utilities.computeHmacSha256Signature(
    signedValue,
    secret,
    Utilities.Charset.UTF_8
  ));
  return fernlyConstantTimeEqual_(expected, envelope.signature);
}

function fernlyMessage_(payload) {
  return {
    subject: "[FERNLY][CRITICAL] " + payload.category + "/" + payload.code,
    body: [
      "Fernly production incident",
      "appId=fernly",
      "environment=production",
      "severity=critical",
      "category=" + payload.category,
      "code=" + payload.code,
      "dedupeLabel=" + payload.dedupeLabel,
      "occurrenceCount=" + payload.occurrenceCount,
      "occurredAt=" + payload.occurredAt
    ].join("\n")
  };
}

function fernlyPruneReplay_(properties, now, currentKey) {
  var snapshot = properties.getProperties();
  Object.keys(snapshot).forEach(function (key) {
    if (key.indexOf(FERNLY_REPLAY_PREFIX) !== 0 || key === currentKey) {
      return;
    }

    var parts = String(snapshot[key]).split("|");
    var recordedAt = Number(parts[1]);
    if (!Number.isFinite(recordedAt) || now - recordedAt > FERNLY_REPLAY_TTL_MS) {
      properties.deleteProperty(key);
    }
  });
}

function doPost(event) {
  var contents = event && event.postData && event.postData.contents;
  if (typeof contents !== "string" || contents.length === 0 || contents.length > 4096) {
    return fernlyJsonStatus_("malformed");
  }

  var envelope;
  try {
    envelope = JSON.parse(contents);
  } catch (_ignored) {
    return fernlyJsonStatus_("malformed");
  }

  if (!fernlyHasExactKeys_(envelope, FERNLY_ENVELOPE_KEYS) ||
      !fernlyValidPayload_(envelope.payload)) {
    return fernlyJsonStatus_("malformed");
  }

  var properties = PropertiesService.getScriptProperties();
  var secret = properties.getProperty("FERNLY_PROVIDER_HMAC_SECRET");
  var now = Date.now();
  if (!fernlyAuthorized_(envelope, secret, now)) {
    return fernlyJsonStatus_("unauthorized");
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var replayKey = FERNLY_REPLAY_PREFIX + envelope.payload.deliveryKey;
    var replayValue = properties.getProperty(replayKey);
    var mask = replayValue ? Number(String(replayValue).split("|")[0]) : 0;
    if (mask === 3) {
      return fernlyJsonStatus_("duplicate");
    }

    var message = fernlyMessage_(envelope.payload);
    FERNLY_APPROVED_RECIPIENTS.forEach(function (recipient, index) {
      var recipientMask = 1 << index;
      if ((mask & recipientMask) !== 0) {
        return;
      }

      MailApp.sendEmail(recipient, message.subject, message.body);
      mask |= recipientMask;
      properties.setProperty(replayKey, mask + "|" + now);
    });
    fernlyPruneReplay_(properties, now, replayKey);
    return fernlyJsonStatus_("sent");
  } finally {
    lock.releaseLock();
  }
}
