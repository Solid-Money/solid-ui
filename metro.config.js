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
  // Packages that should NOT use package exports resolution (have circular dependency issues)
  unstable_enablePackageExports: true,
  unstable_conditionNames: ['require', 'import'], // Prefer CJS to avoid circular deps in ESM
  resolveRequest: (context, moduleName, platform) => {
    // ===========================================
    // FIX: permissionless circular dependency
    // ===========================================
    // Rewrite permissionless imports to use CJS build directly
    // See: https://github.com/pimlicolabs/permissionless.js/issues/61
    if (moduleName === 'permissionless' || moduleName.startsWith('permissionless/')) {
      // Subpaths that map to .js files (not directories with index.js)
      const fileExports = [
        'clients/pimlico',
        'actions/pimlico',
        'actions/erc7579',
        'actions/passkeyServer',
        'actions/etherspot',
        'actions/smartAccount',
      ];

      const subpath = moduleName.replace('permissionless', '').replace(/^\//, '');
      let cjsModule;

      if (subpath === '' || moduleName === 'permissionless') {
        cjsModule = 'permissionless/_cjs/index.js';
      } else if (fileExports.includes(subpath)) {
        cjsModule = `permissionless/_cjs/${subpath}.js`;
      } else {
        cjsModule = `permissionless/_cjs/${subpath}/index.js`;
      }

      return context.resolveRequest(context, cjsModule, platform);
    }

    // ===========================================
    // WEB-ONLY MODULES (block on native)
    // ===========================================
    const webOnlyModules = [
      '@turnkey/sdk-browser',
      '@hpke/core',
      'hpke-js',
      'ws',
      'react-use-intercom',
      'recharts',
    ];

    if (platform !== 'web' && webOnlyModules.includes(moduleName)) {
      return { type: 'empty' };
    }

    // Fix tsyringe/tslib ESM compatibility issue on web
    if (platform === 'web' && moduleName === 'tslib') {
      return context.resolveRequest(context, 'tslib/tslib.es6.js', platform);
    }
    // ===========================================
    // NATIVE-ONLY MODULES (block on web)
    // ===========================================
    // const nativeOnlyModules = [
    //   '@turnkey/sdk-react-native',
    //   'react-native-keychain',
    //   'react-native-passkey',
    //   'react-native-inappbrowser-reborn',
    // ];

    // if (platform === 'web' && nativeOnlyModules.includes(moduleName)) {
    //   return { type: 'empty' };
    // }

    // ===========================================
    // NODE.JS BUILT-INS (for React Native)
    // ===========================================
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

    // Default resolver
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = withNativeWind(config, { input: './global.css' });
