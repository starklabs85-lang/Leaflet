export type MeasurementConsentChoice = "granted" | "denied";

export type ConsentPromptRequest = {
  currentChoice: MeasurementConsentChoice | null;
  mode: "initial" | "settings";
};

export function createConsentPromptController() {
  let snapshot: ConsentPromptRequest | null = null;
  let resolveChoice:
    | ((choice: MeasurementConsentChoice) => void)
    | null = null;
  const listeners = new Set<() => void>();

  function emitChange() {
    listeners.forEach((listener) => listener());
  }

  return {
    getSnapshot() {
      return snapshot;
    },

    requestChoice(request: ConsentPromptRequest) {
      if (resolveChoice) {
        return Promise.reject(
          new Error("A measurement consent prompt is already active.")
        );
      }

      snapshot = request;
      emitChange();

      return new Promise<MeasurementConsentChoice>((resolve) => {
        resolveChoice = resolve;
      });
    },

    submitChoice(choice: MeasurementConsentChoice) {
      const resolve = resolveChoice;

      if (!resolve) {
        return;
      }

      snapshot = null;
      resolveChoice = null;
      emitChange();
      resolve(choice);
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

export const measurementConsentPrompt = createConsentPromptController();
