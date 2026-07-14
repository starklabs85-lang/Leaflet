const { createRunOncePlugin, withPlugins } = require("@expo/config-plugins");
const path = require("path");

const {
  withFirebaseAppDelegate,
  withIosGoogleServicesFile
} = require(path.join(
  __dirname,
  "..",
  "node_modules",
  "@react-native-firebase",
  "app",
  "plugin",
  "build",
  "ios"
));

function withIosFirebaseApp(config) {
  return withPlugins(config, [
    withFirebaseAppDelegate,
    withIosGoogleServicesFile
  ]);
}

module.exports = createRunOncePlugin(
  withIosFirebaseApp,
  "with-ios-firebase-app",
  "1.0.0"
);
