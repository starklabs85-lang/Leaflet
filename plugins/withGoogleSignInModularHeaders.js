const { withPodfile } = require("@expo/config-plugins");

const PODS = [
  "  pod 'GoogleUtilities', :modular_headers => true",
  "  pod 'RecaptchaInterop', :modular_headers => true"
];

function withGoogleSignInModularHeaders(config) {
  return withPodfile(config, (config) => {
    let contents = config.modResults.contents;

    if (PODS.every((pod) => contents.includes(pod))) {
      return config;
    }

    const insertion = PODS.filter((pod) => !contents.includes(pod)).join("\n");
    const marker = "  use_expo_modules!";

    if (!contents.includes(marker)) {
      throw new Error("Could not find use_expo_modules! in the generated Podfile.");
    }

    contents = contents.replace(marker, `${marker}\n${insertion}`);
    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withGoogleSignInModularHeaders;
