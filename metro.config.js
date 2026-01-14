const { withNativeWind } = require('nativewind/metro');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

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
  unstable_enablePackageExports: true,
};

config.transformer.minifierConfig = {
  compress: {
    // The option below removes all console logs statements in production.
    drop_console: true,
  },
};

module.exports = withNativeWind(config, { input: './global.css' });
