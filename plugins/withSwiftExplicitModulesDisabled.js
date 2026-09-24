const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin: set `SWIFT_ENABLE_EXPLICIT_MODULES=NO` for all Pods and
 * app targets.
 *
 * On Xcode 16+/26, CocoaPods plus Swift pods — NitroModules (pulled in by
 * react-native-nitro-modules and react-native-mmkv) and RN's own RCTSwiftUI —
 * fail the app target's "Emit Swift module" phase with
 * "module map file ... not found". Disabling explicit Swift modules avoids it.
 *
 * This arrived as @onramper/onramper-react-native's own app.plugin.js and was
 * kept when that package was removed: the fix was never Onramper-specific, and
 * the pods that still need it are still here.
 *
 * ios/ is prebuild-generated (gitignored), so this re-applies on every
 * `expo prebuild`. Idempotent via the marker.
 */
const MARKER = 'disable explicit Swift modules (withSwiftExplicitModulesDisabled)';

const SNIPPET = [
  `    # ${MARKER}`,
  '    installer.pods_project.targets.each do |t|',
  "      t.build_configurations.each { |c| c.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO' }",
  '    end',
  '    installer.aggregate_targets.each do |at|',
  '      next if at.user_project.nil?',
  '      at.user_project.native_targets.each do |t|',
  "        t.build_configurations.each { |c| c.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO' }",
  '      end',
  '      at.user_project.save',
  '    end',
].join('\n');

module.exports = function withSwiftExplicitModulesDisabled(config) {
  return withDangerousMod(config, [
    'ios',
    cfg => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');

      if (!contents.includes(MARKER)) {
        // Top of Expo's generated `post_install do |installer|` block.
        contents = contents.replace(/(post_install do \|installer\|\n)/, `$1${SNIPPET}\n`);
        fs.writeFileSync(podfile, contents);
      }

      return cfg;
    },
  ]);
};
