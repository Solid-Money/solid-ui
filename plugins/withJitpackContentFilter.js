const { withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * Expo config plugin: restricts JitPack repository to com.github.* groups only.
 * Prevents Gradle from timing out when resolving non-JitPack artifacts
 * (e.g. com.amplitude) during Android builds.
 */
module.exports = function withJitpackContentFilter(config) {
  return withProjectBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;

    // Check if JitPack is referenced but missing the content filter
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
};
