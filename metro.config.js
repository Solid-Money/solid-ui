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
  unstable_enablePackageExports: true,
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
};

config.transformer.minifierConfig = {
  compress: {
    // The option below removes all console logs statements in production.
    drop_console: true,
  },
};

// Memory optimization: Limit parallel workers during bundling
// Reduces peak memory usage at the cost of slightly slower builds
config.maxWorkers = process.env.METRO_MAX_WORKERS
  ? parseInt(process.env.METRO_MAX_WORKERS, 10)
  : Math.max(1, Math.floor(require('os').cpus().length / 2));

// Enable file-based caching to reduce memory pressure
config.cacheStores = [
  new (require('metro-cache').FileStore)({
    root: `${__dirname}/.metro-cache`,
  }),
];

// Increase server connection handling for asset requests
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Increase timeout for asset requests
      res.setTimeout(60000);
      return middleware(req, res, next);
    };
  },
};

module.exports = withNativeWind(config, { input: './global.css' });
