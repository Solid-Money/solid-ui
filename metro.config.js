const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

// Custom resolver to handle platform-specific modules
config.resolver = {
  ...config.resolver,
  alias: {
    ...config.resolver?.alias,
    stream: 'stream-browserify',
    crypto: 'react-native-quick-crypto',
  },
  resolveRequest: (context, moduleName, platform) => {
    // Block browser-specific modules when building for native platforms
    if (platform !== 'web' && (
      moduleName === '@turnkey/sdk-browser' ||
      moduleName === '@hpke/core' ||
      moduleName === 'hpke-js'
    )) {
      // Return an empty module for these packages on native platforms
      return {
        type: 'empty',
      };
    }

    // Handle Node.js built-ins for React Native
    if (platform !== 'web' && moduleName === 'stream') {
      return context.resolveRequest(context, 'stream-browserify', platform);
    }

    // Default resolver for all other modules
    return context.resolveRequest(context, moduleName, platform);
  },
  unstable_enablePackageExports: true,
};

module.exports = withNativeWind(config, { input: './global.css' })
