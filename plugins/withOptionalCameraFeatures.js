const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo config plugin: keep camera hardware optional for Play Store filtering.
 *
 * Google Play installs an app only on devices that have every `uses-feature`
 * the merged manifest marks as required. Two things make camera required here:
 *
 *   1. com.sumsub.sns:idensic-mobile-sdk declares it explicitly —
 *        <uses-feature android:name="android.hardware.camera"
 *                      android:required="true" />
 *      and the merger ORs `android:required`, so a library's `true` beats
 *      expo-camera's `false`.
 *   2. `android.permission.CAMERA` implies android.hardware.camera and
 *      android.hardware.camera.autofocus as required unless the manifest
 *      declares them optional. See
 *      https://developer.android.com/guide/topics/manifest/uses-feature-element
 *
 * The result is a device-support regression: Play drops every camera-less
 * device, and existing users on those devices stop receiving updates. Nothing
 * in the app needs a camera to install — QR scanning (expo-camera) and Sumsub
 * KYC are both optional flows that already handle being unavailable — so
 * declare the features optional and `tools:replace` the library's value.
 *
 * android/ is prebuild-generated (gitignored), so this re-applies on every
 * `expo prebuild`.
 */
const TOOLS_NAMESPACE = 'http://schemas.android.com/tools';

const OPTIONAL_FEATURES = [
  'android.hardware.camera',
  'android.hardware.camera.autofocus',
  // Sumsub liveness uses the selfie camera; devices without one just cannot
  // finish KYC, which is not a reason to block them from installing.
  'android.hardware.camera.front',
];

module.exports = function withOptionalCameraFeatures(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;

    // `tools:replace` is only valid when the tools namespace is declared.
    androidManifest.manifest.$ = androidManifest.manifest.$ || {};
    if (!androidManifest.manifest.$['xmlns:tools']) {
      androidManifest.manifest.$['xmlns:tools'] = TOOLS_NAMESPACE;
    }

    androidManifest.manifest['uses-feature'] = androidManifest.manifest['uses-feature'] || [];

    for (const name of OPTIONAL_FEATURES) {
      const attributes = {
        'android:name': name,
        'android:required': 'false',
        'tools:replace': 'android:required',
      };

      const existing = androidManifest.manifest['uses-feature'].find(
        (item) => item.$ && item.$['android:name'] === name,
      );

      if (existing) {
        existing.$ = { ...existing.$, ...attributes };
      } else {
        androidManifest.manifest['uses-feature'].push({ $: attributes });
      }
    }

    return config;
  });
};
