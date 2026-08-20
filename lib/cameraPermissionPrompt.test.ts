import assert from "node:assert/strict";
import test from "node:test";

import { getCameraPermissionPromptCopy } from "./cameraPermissionPrompt";

test("uses a neutral action for camera pre-permission prompts", () => {
  assert.deepEqual(getCameraPermissionPromptCopy(), {
    accessibilityLabel: "Continue to camera permission request",
    buttonLabel: "Continue"
  });
});
