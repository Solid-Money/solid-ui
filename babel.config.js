module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxImportSource: "nativewind",
        }
      ],
    ],
    plugins: [
      ["nativewind/babel", { mode: "compileOnly" }],
      "react-native-worklets-core/plugin",
      "react-native-reanimated/plugin", // Must be last
    ],
  };
};