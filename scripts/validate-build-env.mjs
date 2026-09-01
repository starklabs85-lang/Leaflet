import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const COMMON_REQUIRED_VARIABLES = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY"
];

const IOS_REQUIRED_VARIABLES = [
  "EXPO_PUBLIC_REVENUECAT_IOS_KEY",
  "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
  "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
  "EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME"
];

const ANDROID_REQUIRED_VARIABLES = [
  "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY",
  "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"
];

export function validateBuildEnvironment(
  env,
  fileExists = existsSync,
  readFile = readFileSync
) {
  const platform = env.EAS_BUILD_PLATFORM;
  const requiredVariables = [
    ...COMMON_REQUIRED_VARIABLES,
    ...(platform === "ios"
      ? IOS_REQUIRED_VARIABLES
      : platform === "android"
        ? ANDROID_REQUIRED_VARIABLES
        : [])
  ];
  const errors = requiredVariables
    .filter((name) => !hasValue(env[name]))
    .map((name) => `Missing ${name}.`);

  if (platform === "ios") {
    const plistPath = hasValue(env.GOOGLE_SERVICES_INFO_PLIST)
      ? env.GOOGLE_SERVICES_INFO_PLIST
      : "GoogleService-Info.plist";

    if (!fileExists(plistPath)) {
      errors.push("Missing iOS Firebase configuration file.");
    } else {
      try {
        const plist = readFile(plistPath);

        if (!String(plist).trimStart().startsWith("<?xml")) {
          errors.push("iOS Firebase configuration file must use XML plist format.");
        }
      } catch {
        errors.push("Missing iOS Firebase configuration file.");
      }
    }
  }

  if (
    env.EAS_BUILD_PROFILE === "production" &&
    (hasValue(env.EXPO_PUBLIC_DEV_TEST_EMAIL) ||
      hasValue(env.EXPO_PUBLIC_DEV_TEST_PASSWORD))
  ) {
    errors.push("Production builds must not contain dev-login credentials.");
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function run() {
  const result = validateBuildEnvironment(process.env);

  if (!result.ok) {
    console.error("Fernly build configuration is invalid:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Fernly build configuration is present.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
