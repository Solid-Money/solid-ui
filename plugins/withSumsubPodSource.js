const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin: register Sumsub's CocoaPods spec repo.
 *
 * `@sumsub/react-native-mobilesdk-module` depends on `IdensicMobileSDK`, which
 * Sumsub publishes to its own spec repo (github.com/SumSubstance/Specs) rather
 * than to CocoaPods trunk. Without it, `pod install` fails with:
 *   [!] Unable to find a specification for `IdensicMobileSDK (= 1.44.0)`
 *       depended upon by `react-native-mobilesdk-module`
 *
 * Declaring any `source` in a Podfile disables the implicit trunk default, so
 * the CDN is re-declared here alongside Sumsub's repo — otherwise every other
 * pod stops resolving.
 *
 * ios/ is prebuild-generated (gitignored), so this plugin re-applies on every
 * `expo prebuild`.
 */
const MARKER = 'Sumsub spec repo (withSumsubPodSource)';

const SNIPPET = `# ${MARKER}
source 'https://github.com/SumSubstance/Specs.git'
source 'https://cdn.cocoapods.org/'
`;

module.exports = function withSumsubPodSource(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfilePath, 'utf8');

      if (contents.includes(MARKER)) {
        return config;
      }

      // `source` is resolved before any target installs pods, so it belongs at
      // the top of the Podfile, ahead of the autolinking requires.
      fs.writeFileSync(podfilePath, `${SNIPPET}\n${contents}`);
      return config;
    },
  ]);
};
