import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const cameraPurpose =
  "Fernly uses your camera to take plant photos for identification, health diagnosis, and growth tracking—for example, photographing a leaf to identify the plant or check for disease.";
const photoLibraryPurpose =
  "Fernly uses your photo library to choose plant photos for identification, health diagnosis, and growth tracking—for example, selecting a leaf photo to identify the plant or add it to a growth timeline.";

const config = JSON.parse(
  execFileSync(
    process.execPath,
    ["node_modules/expo/bin/cli", "config", "--type", "introspect", "--json"],
    {
      cwd: process.cwd(),
      encoding: "utf8"
    }
  )
);
const infoPlist = config._internal.modResults.ios.infoPlist;
const androidPermissions = config.android?.permissions ?? [];

test("uses App Store version 1.0 in native iOS metadata", () => {
  assert.equal(config.version, "1.0");
  assert.equal(infoPlist.CFBundleShortVersionString, "1.0");
});

test("explains camera and photo-library access with the approved copy", () => {
  assert.equal(infoPlist.NSCameraUsageDescription, cameraPurpose);
  assert.equal(infoPlist.NSPhotoLibraryUsageDescription, photoLibraryPurpose);
});

test("does not request unused microphone access", () => {
  assert.equal(
    Object.hasOwn(infoPlist, "NSMicrophoneUsageDescription"),
    false
  );
  assert.equal(androidPermissions.includes("android.permission.RECORD_AUDIO"), false);
});

test("shows the native app version in Profile without beta labeling", () => {
  const profileSource = readFileSync("app/(auth)/(tabs)/profile.tsx", "utf8");

  assert.doesNotMatch(profileSource, /Fernly Beta/);
  assert.match(profileSource, /from "expo-constants"/);
  assert.match(profileSource, /Constants\.nativeAppVersion/);
  assert.match(profileSource, /Fernly \{nativeVersion\}/);
});
