const { withNativeWind } = require('nativewind/metro');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

const originalResolveRequest = config.resolver?.resolveRequest;
let isResolving = false;

config.resolver = {
  ...config.resolver,
  blockList: [/node_modules\/.*\/ox\/tempo\/.*/],
  alias: {
    ...config.resolver?.alias,
    stream: 'stream-browserify',
    crypto: 'react-native-quick-crypto',
    http: 'stream-http',
    https: 'https-browserify',
    events: 'events',
  },
  resolveRequest: (context, moduleName, platform) => {
    // Prevent infinite recursion
    if (isResolving) {
      return originalResolveRequest
        ? originalResolveRequest(context, moduleName, platform)
        : context.resolveRequest(context, moduleName, platform);
    }

    // Fix tslib ESM compatibility issue on web
    if (platform === 'web' && moduleName === 'tslib') {
      isResolving = true;
      try {
        return originalResolveRequest
          ? originalResolveRequest(context, 'tslib/tslib.es6.js', platform)
          : context.resolveRequest(context, 'tslib/tslib.es6.js', platform);
      } finally {
        isResolving = false;
      }
    }

    // Use default resolver
    return originalResolveRequest
      ? originalResolveRequest(context, moduleName, platform)
      : context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = withNativeWind(config, { input: './global.css' });
