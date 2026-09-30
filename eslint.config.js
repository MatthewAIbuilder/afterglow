// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // scripts/ holds tools run outside the app (their packages aren't app dependencies).
    ignores: ["dist/*", "scripts/*"],
  }
]);
