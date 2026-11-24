const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo config plugin: declare the hardware features Google Play infers for us
 * as optional, so the store does not hide the app from devices without them.
 *
 * Neither feature is declared anywhere; Google Play infers both as REQUIRED:
 *   - android.hardware.screen.portrait, from `orientation: 'portrait'` in
 *     app.config.ts, which locks MainActivity to portrait.
 *   - android.hardware.wifi, from the ACCESS_WIFI_STATE permission that
 *     @react-native-community/netinfo adds to read the connection type.
 * Play Console then blocks review with "Required hardware feature declarations
 * are restricting your app's availability" (Phone, Tablet, Desktop, XR).
 *
 * The app needs neither: it works over any network, and on a device without a
 * portrait screen Android shows the portrait layout letterboxed. Declaring a
 * feature explicitly stops Play inferring it, so `android:required="false"`
 * keeps the portrait lock and the permission while dropping the install
 * restriction. `tools:replace` makes ours win if a library ever declares the
 * same feature as required (the merger otherwise ORs `required` to true).
 *
 * See https://developer.android.com/develop/ui/compose/layouts/adaptive/increase-app-availability
 *
 * android/ is prebuild-generated (gitignored), so this re-applies on every
 * `expo prebuild`.
 */
const OPTIONAL_FEATURES = ['android.hardware.screen.portrait', 'android.hardware.wifi'];
const TOOLS_NAMESPACE = 'http://schemas.android.com/tools';

module.exports = function withOptionalHardwareFeatures(config) {
  return withAndroidManifest(config, config => {
    const manifest = config.modResults.manifest;

    // `tools:replace` is only valid when the tools namespace is declared.
    manifest.$ = manifest.$ || {};
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = TOOLS_NAMESPACE;
    }

    manifest['uses-feature'] = manifest['uses-feature'] || [];

    for (const name of OPTIONAL_FEATURES) {
      const attributes = {
        'android:name': name,
        'android:required': 'false',
        'tools:replace': 'android:required',
      };
      const existing = manifest['uses-feature'].find(
        item => item.$ && item.$['android:name'] === name,
      );
      if (existing) {
        existing.$ = { ...existing.$, ...attributes };
      } else {
        manifest['uses-feature'].push({ $: attributes });
      }
    }

    return config;
  });
};
