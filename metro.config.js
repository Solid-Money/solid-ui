const {getDefaultConfig} = require("expo/metro-config");
const {withNativeWind} = require("nativewind/metro");
const fs = require("fs");
const path = require("path");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// HTTPS configuration for local development
const httpsConfig = {
  key: fs.readFileSync(path.resolve(__dirname, "localhost-key.pem")),
  cert: fs.readFileSync(path.resolve(__dirname, "localhost-cert.pem")),
};

// Custom resolver to handle platform-specific modules
config.resolver = {
  ...config.resolver,
  alias: {
    ...config.resolver?.alias,
    stream: "stream-browserify",
    crypto: "react-native-quick-crypto",
    http: "stream-http",
    https: "https-browserify",
    events: "events",
  },
  resolveRequest: (context, moduleName, platform) => {
    // Block browser-specific modules when building for native platforms
    if (
      platform !== "web" &&
      (moduleName === "@turnkey/sdk-browser" ||
        moduleName === "@hpke/core" ||
        moduleName === "hpke-js" ||
        moduleName === "ws")
    ) {
      // Return an empty module for these packages on native platforms
      return {
        type: "empty",
      };
    }

    // Handle Node.js built-ins for React Native
    if (platform !== "web") {
      const nodeModuleMappings = {
        stream: "stream-browserify",
        crypto: "react-native-quick-crypto",
        http: "stream-http",
        https: "https-browserify",
        events: "events",
      };

      if (nodeModuleMappings[moduleName]) {
        return context.resolveRequest(
          context,
          nodeModuleMappings[moduleName],
          platform,
        );
      }
    }

    // Default resolver for all other modules
    return context.resolveRequest(context, moduleName, platform);
  },
  unstable_enablePackageExports: true,
};

// Configure HTTPS for development server
config.server = {
  ...config.server,
  https: httpsConfig,
  host: "localhost",
  port: 443,
};

module.exports = withNativeWind(config, {input: "./global.css"});
