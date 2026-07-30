import assert from "node:assert/strict";
import test from "node:test";

import { createConsentPromptController } from "./consentPrompt";

test("the prompt exposes a request and resolves only after a user choice", async () => {
  const controller = createConsentPromptController();
  const choicePromise = controller.requestChoice({
    currentChoice: null,
    mode: "initial"
  });

  assert.deepEqual(controller.getSnapshot(), {
    currentChoice: null,
    mode: "initial"
  });

  controller.submitChoice("granted");

  assert.equal(await choicePromise, "granted");
  assert.equal(controller.getSnapshot(), null);
});

test("a second request cannot replace a choice already on screen", async () => {
  const controller = createConsentPromptController();
  const firstChoice = controller.requestChoice({
    currentChoice: null,
    mode: "initial"
  });

  await assert.rejects(
    controller.requestChoice({
      currentChoice: "granted",
      mode: "settings"
    }),
    /already active/
  );

  controller.submitChoice("denied");
  assert.equal(await firstChoice, "denied");
});
