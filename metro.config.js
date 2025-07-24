const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

// Custom resolver to handle platform-specific modules
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: true,
  unstable_conditionNames: [
    "react-native",
    "browser",
    "require",
  ],
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

    // Default resolver for all other modules
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = withNativeWind(config, { input: './global.css' })
