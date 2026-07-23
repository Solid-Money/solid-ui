const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin: force `FMT_USE_CONSTEVAL=0` for all Pods.
 *
 * React Native 0.83 pins fmt 11.0.2 (via RCT-Folly.podspec). Under the newer,
 * stricter Apple clang shipped with Xcode 26+, fmt's `consteval FMT_STRING`
 * path fails to compile ("call to consteval function ... is not a constant
 * expression" in fmt/format-inl.h). Defining FMT_USE_CONSTEVAL=0 makes fmt fall
 * back to `constexpr`, which compiles cleanly. Harmless on older toolchains.
 *
 * ios/ is prebuild-generated (gitignored), so this plugin re-applies the patch
 * on every `expo prebuild`.
 */
const MARKER = 'FMT_USE_CONSTEVAL fix (withFmtConstevalFix)';

// fmt/base.h defines FMT_USE_CONSTEVAL unconditionally (no #ifndef guard), so a
// -DFMT_USE_CONSTEVAL=0 compiler flag is overridden by the header. We instead
// rewrite the header's two `#define FMT_USE_CONSTEVAL 1` branches to 0, forcing
// the constexpr fallback. Runs in post_install, i.e. after CocoaPods downloads
// the fmt pod, and is idempotent.
const SNIPPET = `
    # ${MARKER}
    fmt_base_h = File.join(__dir__, 'Pods', 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base_h)
      fmt_src = File.read(fmt_base_h)
      fmt_patched = fmt_src.gsub('#  define FMT_USE_CONSTEVAL 1', '#  define FMT_USE_CONSTEVAL 0')
      File.write(fmt_base_h, fmt_patched) if fmt_patched != fmt_src
    end
`;

module.exports = function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile',
      );
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (contents.includes(MARKER)) {
        return config;
      }

      // Inject our loop at the top of the existing post_install block.
      const anchor = /post_install do \|installer\|\n/;
      if (!anchor.test(contents)) {
        throw new Error(
          'withFmtConstevalFix: could not find `post_install do |installer|` in Podfile',
        );
      }
      contents = contents.replace(anchor, (match) => match + SNIPPET);

      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);
};
