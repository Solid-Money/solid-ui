const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to fix React Native Firebase build error on Expo 54 / React Native 0.81.
 *
 * This issue occurs when using:
 * - New Architecture (newArchEnabled: true)
 * - Static frameworks (ios.useFrameworks: 'static')
 * - React Native Firebase
 *
 * Workaround from: https://github.com/invertase/react-native-firebase/issues/8657
 * Sets CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES at project level.
 */
const withFirebaseModularHeadersFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      // Check if the fix is already applied
      if (podfile.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        return config;
      }

      // The code to inject - fixes Firebase build error on RN 0.81 + New Arch
      // This sets the flag at the PROJECT level (not just per-target)
      const fixCode = `
    # Fix for React Native Firebase with Expo 54 / RN 0.81 + New Architecture
    # https://github.com/invertase/react-native-firebase/issues/8657
    installer.pods_project.build_configurations.each do |config|
      config.build_settings["CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES"] = "YES"
    end
`;

      // Find the end of post_install block and insert before it
      const postInstallEndRegex = /(react_native_post_install\(\s*\n\s*installer,[\s\S]*?\)\s*\n)(\s*end\s*\nend)/;

      if (postInstallEndRegex.test(podfile)) {
        podfile = podfile.replace(postInstallEndRegex, `$1${fixCode}$2`);
      } else {
        // Fallback: simpler pattern matching
        const simplePattern = /(react_native_post_install\([^)]+\))\s*\n(\s*end\s*\nend)/;
        if (simplePattern.test(podfile)) {
          podfile = podfile.replace(simplePattern, `$1\n${fixCode}$2`);
        }
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};

module.exports = withFirebaseModularHeadersFix;
