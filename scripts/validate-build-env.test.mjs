import assert from "node:assert/strict";
import test from "node:test";

import { validateBuildEnvironment } from "./validate-build-env.mjs";

const VALID_IOS_ENV = {
  EAS_BUILD_PLATFORM: "ios",
  EAS_BUILD_PROFILE: "development-device",
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: "ios-client",
  EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME: "ios-scheme",
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: "web-client",
  EXPO_PUBLIC_REVENUECAT_IOS_KEY: "revenuecat-public-key",
  EXPO_PUBLIC_SUPABASE_ANON_KEY: "supabase-public-key",
  EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  GOOGLE_SERVICES_INFO_PLIST: "/private/build/GoogleService-Info.plist"
};
const XML_PLIST = () => Buffer.from("<?xml version=\"1.0\"?><plist></plist>");

test("fails an iOS build before compilation when client configuration is missing", () => {
  const result = validateBuildEnvironment(
    {
      EAS_BUILD_PLATFORM: "ios",
      EAS_BUILD_PROFILE: "development-device",
      GOOGLE_SERVICES_INFO_PLIST: "/private/build/GoogleService-Info.plist"
    },
    () => true,
    XML_PLIST
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    "Missing EXPO_PUBLIC_SUPABASE_URL.",
    "Missing EXPO_PUBLIC_SUPABASE_ANON_KEY.",
    "Missing EXPO_PUBLIC_REVENUECAT_IOS_KEY.",
    "Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.",
    "Missing EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.",
    "Missing EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME."
  ]);
});

test("fails an iOS build when its Firebase plist is unavailable", () => {
  const result = validateBuildEnvironment(VALID_IOS_ENV, () => false);

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ["Missing iOS Firebase configuration file."]);
});

test("fails before Expo introspection when the Firebase plist is binary", () => {
  const result = validateBuildEnvironment(
    VALID_IOS_ENV,
    () => true,
    () => Buffer.from("bplist00")
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    "iOS Firebase configuration file must use XML plist format."
  ]);
});

test("rejects dev-login credentials from a production build", () => {
  const result = validateBuildEnvironment(
    {
      ...VALID_IOS_ENV,
      EAS_BUILD_PROFILE: "production",
      EXPO_PUBLIC_DEV_TEST_EMAIL: "qa@example.com",
      EXPO_PUBLIC_DEV_TEST_PASSWORD: "not-for-production"
    },
    () => true,
    XML_PLIST
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    "Production builds must not contain dev-login credentials."
  ]);
});

test("accepts a fully configured iOS development build", () => {
  const checkedPaths = [];
  const result = validateBuildEnvironment(
    VALID_IOS_ENV,
    (path) => {
      checkedPaths.push(path);
      return true;
    },
    XML_PLIST
  );

  assert.deepEqual(result, { ok: true, errors: [] });
  assert.deepEqual(checkedPaths, ["/private/build/GoogleService-Info.plist"]);
});
