const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo config plugin: resolve the ML Kit vision-dependency manifest conflict.
 *
 * Google Play reads the `com.google.mlkit.vision.DEPENDENCIES` meta-data to
 * decide which ML model modules to download when the app is installed. Two of
 * our dependencies declare the same key with different values:
 *   - com.sumsub.sns:idensic-mobile-sdk  -> "face"       (liveness / selfie)
 *   - host.exp.exponent:expo.modules.camera -> "barcode_ui" (QR scanning)
 *
 * The manifest merger cannot pick a winner and fails the build:
 *   Execution failed for task ':app:processReleaseMainManifest'.
 *   > Manifest merger failed with multiple errors
 *
 * The attribute is a comma-separated module list, so we declare the union in
 * the app manifest and mark it as the explicit override. Keeping both halves
 * matters: dropping "face" breaks Sumsub liveness, dropping "barcode_ui"
 * breaks expo-camera's scanner — each would fail at runtime, not build time.
 *
 * android/ is prebuild-generated (gitignored), so this re-applies on every
 * `expo prebuild`.
 */
const META_DATA_NAME = 'com.google.mlkit.vision.DEPENDENCIES';
const MERGED_VALUE = 'face,barcode_ui';
const TOOLS_NAMESPACE = 'http://schemas.android.com/tools';

module.exports = function withMlkitVisionDependencies(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;

    // `tools:replace` is only valid when the tools namespace is declared.
    androidManifest.manifest.$ = androidManifest.manifest.$ || {};
    if (!androidManifest.manifest.$['xmlns:tools']) {
      androidManifest.manifest.$['xmlns:tools'] = TOOLS_NAMESPACE;
    }

    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
    mainApplication['meta-data'] = mainApplication['meta-data'] || [];

    const attributes = {
      'android:name': META_DATA_NAME,
      'android:value': MERGED_VALUE,
      'tools:replace': 'android:value',
    };

    const existing = mainApplication['meta-data'].find(
      (item) => item.$ && item.$['android:name'] === META_DATA_NAME,
    );

    if (existing) {
      existing.$ = { ...existing.$, ...attributes };
    } else {
      mainApplication['meta-data'].push({ $: attributes });
    }

    return config;
  });
};
