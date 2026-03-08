const {
  withGradleProperties,
  withProjectBuildGradle,
} = require('@expo/config-plugins');

/**
 * Expo config plugin: disables React Native's automatic JitPack repository
 * and restricts the Expo-generated JitPack entry to com.github.* groups only.
 *
 * Prevents Gradle from timing out when resolving non-JitPack artifacts
 * (e.g. com.amplitude) during Android builds.
 */
module.exports = function withJitpackContentFilter(config) {
  // 1. Disable the JitPack repo that React Native's Gradle plugin adds programmatically
  config = withGradleProperties(config, (config) => {
    config.modResults.push({
      type: 'property',
      key: 'react.includeJitpackRepository',
      value: 'false',
    });
    return config;
  });

  // 2. Restrict the JitPack repo in build.gradle (added by Expo) to com.github.* only
  config = withProjectBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;

    if (
      buildGradle.includes('jitpack.io') &&
      !buildGradle.includes('includeGroupByRegex')
    ) {
      config.modResults.contents = buildGradle.replace(
        /maven\s*\{\s*url\s*['"]https:\/\/www\.jitpack\.io['"]\s*\}/,
        `maven {
      url 'https://www.jitpack.io'
      content {
        includeGroupByRegex 'com\\\\.github\\\\..*'
      }
    }`,
      );
    }

    return config;
  });

  return config;
};
