module.exports = function (api) {
  api.cache(true);

  const plugins = [
    "react-native-reanimated/plugin",
  ];

  // Strip console statements in production builds (keep error/warn for debugging)
  if (process.env.EXPO_PUBLIC_ENVIRONMENT === 'production') {
    plugins.unshift(['transform-remove-console', { exclude: ['error', 'warn'] }]);
  }

  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxImportSource: "nativewind",
          unstable_transformImportMeta: true
        }
      ],
      "nativewind/babel",
    ],
    plugins,
  };
};
