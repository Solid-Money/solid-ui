const { withNativeWind } = require('nativewind/metro');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

// Expo injects this legacy watcher flag, but Metro 0.83 no longer accepts it.
if (config.watcher?.unstable_workerThreads !== undefined) {
  delete config.watcher.unstable_workerThreads;
}

// Custom resolver to handle platform-specific modules
config.resolver = {
  ...config.resolver,
  blockList: [
    /node_modules\/.*\/ox\/tempo\/.*/,
  ],
  alias: {
    ...config.resolver?.alias,
    stream: 'stream-browserify',
    crypto: 'react-native-quick-crypto',
    http: 'stream-http',
    https: 'https-browserify',
    events: 'events',
  },
  resolveRequest: (context, moduleName, platform) => {
    // @onramper/onramper-react-native is an iOS-only Nitro module. Its
    // OnramperCheckoutButtonView calls getHostComponent() at import time, which
    // deep-imports react-native/Libraries/NativeComponent/NativeComponentRegistry
    // — RN internals that don't exist in a react-native-web bundle. Stub it on
    // web so merely importing it can't break the web build.
    // Android is left alone on purpose: the import is lazy there (RN registers
    // the view config without resolving it), and the package throws its own
    // clear "iOS-only in this release" error if you actually call it.
    if (platform === 'web' && moduleName.startsWith('@onramper/onramper-react-native')) {
      return { type: 'empty' };
    }

    // Block browser-specific modules when building for native platforms
    if (
      platform !== 'web' &&
      (moduleName === '@turnkey/sdk-browser' ||
        moduleName === '@hpke/core' ||
        moduleName === 'hpke-js' ||
        moduleName === 'ws' ||
        moduleName === 'react-use-intercom' ||
        moduleName === 'recharts')
    ) {
      // Return an empty module for these packages on native platforms
      return {
        type: 'empty',
      };
    }

    // Handle Node.js built-ins for React Native
    if (platform !== 'web') {
      const nodeModuleMappings = {
        stream: 'stream-browserify',
        crypto: 'react-native-quick-crypto',
        http: 'stream-http',
        https: 'https-browserify',
        events: 'events',
      };

      if (nodeModuleMappings[moduleName]) {
        return context.resolveRequest(context, nodeModuleMappings[moduleName], platform);
      }
    }

    if (platform === 'web' && moduleName === 'tslib') {
      return context.resolveRequest(context, 'tslib/tslib.es6.js', platform);
    }

    // Default resolver for all other modules
    return context.resolveRequest(context, moduleName, platform);
  },
};

config.transformer.minifierConfig = {
  compress: {
    // The option below removes all console logs statements in production.
    drop_console: true,
  },
};

/**
 * Defer module evaluation until a module is first used.
 *
 * Sentry's `app.start.cold` spans put ~94% of a cold start in "JS Bundle
 * Execution Before React Root" — the app is not waiting on the network at that
 * point, it is evaluating every module in the graph, because without this Metro
 * hoists every `require` to the top of its module. That means thirdweb, viem,
 * wagmi, permissionless, the Turnkey and Sumsub SDKs, Intercom, Lottie and the
 * rest are all constructed before the first screen renders, whether or not the
 * user will ever reach a screen that needs them.
 *
 * `inlineRequires` rewrites each `require` to its first point of use, so a
 * module is evaluated when something actually reads from it.
 *
 * The trade-off is import-time side effects: a module imported purely so its
 * top-level code runs, and whose exports are never referenced, would never be
 * evaluated. `nonInlinedRequires` pins those. The list below is Metro's default
 * set plus this app's own ordering-sensitive imports — see `index.js`, which
 * deliberately loads Reanimated, then the crypto polyfill, then the thirdweb
 * adapter, before Expo Router.
 */
config.transformer.getTransformOptions = async () => ({
  transform: {
    // Matches the Expo default (see @expo/metro-config's ExpoMetroConfig);
    // repeated here because returning this object replaces Expo's own
    // getTransformOptions rather than merging with it.
    experimentalImportSupport: true,
    inlineRequires: true,
    nonInlinedRequires: [
      // Metro's defaults — the module registry and React's runtime must be
      // initialised eagerly.
      '@react-native/js-polyfills',
      'React',
      'react',
      'react-compiler-runtime',
      'react/jsx-dev-runtime',
      'react/jsx-runtime',
      'react-native',
      // Ordering-sensitive polyfills from index.js. Each is imported for the
      // side effect of installing globals that later modules assume are
      // present, so none may be deferred to first use.
      'react-native-reanimated',
      'react-native-get-random-values',
      'react-native-quick-crypto',
      '@thirdweb-dev/react-native-adapter',
      // Installs the global CSS interop that NativeWind's styling depends on.
      'react-native-css-interop',
    ],
  },
});

// inlineRem: NativeWind defaults to 14px on native. Set to 16 to match web rem sizing.
module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
