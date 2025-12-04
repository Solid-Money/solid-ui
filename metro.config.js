const { withNativeWind } = require('nativewind/metro');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

// Custom resolver to handle platform-specific modules
config.resolver = {
  ...config.resolver,
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
    // @turnkey/sdk-browser is kept for web-only recovery.tsx but should be empty on native
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

    // Fix tsyringe/tslib ESM compatibility issue on web
    if (platform === 'web' && moduleName === 'tslib') {
      return context.resolveRequest(context, 'tslib/tslib.es6.js', platform);
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

    // Default resolver for all other modules
    return context.resolveRequest(context, moduleName, platform);
  },
  unstable_enablePackageExports: true,
};

module.exports = withNativeWind(config, { input: './global.css' });
