/**
 * The native fingerprint decides what a push to master ships
 * (.eas/workflows/deploy-mobile.yml): if a store build with the same
 * fingerprint exists, an OTA update; otherwise a new store build and submission.
 *
 * `extra.otaCriticalSince` (app.config.ts) is read only by JS, from the update's
 * manifest, and changes whenever an update is marked critical. Left in, setting
 * it would change the fingerprint and send the release to the stores instead of
 * out as an update. Everything else in the config still counts.
 *
 * @type {import('@expo/fingerprint').Config}
 */
const config = {
  fileHookTransform: (source, chunk) => {
    if (source.type !== 'contents' || source.id !== 'expoConfig' || typeof chunk !== 'string') {
      return chunk;
    }
    const expoConfig = JSON.parse(chunk);
    if (!expoConfig.extra || !('otaCriticalSince' in expoConfig.extra)) return chunk;
    delete expoConfig.extra.otaCriticalSince;
    // Same compact form the fingerprint serializes the config in, so the result
    // matches the builds made before this key existed.
    return JSON.stringify(expoConfig);
  },
};

module.exports = config;
