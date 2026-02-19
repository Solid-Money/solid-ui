const { IOSConfig, withXcodeProject } = require('@expo/config-plugins');
const { access, constants } = require('fs/promises');
const path = require('path');

/**
 * Expo config plugin: adds mea_config to iOS app bundle resources for MeaWallet MPP.
 * Run expo prebuild to apply. Requires mea_config file from MeaWallet.
 */
module.exports = function withMeaConfigIos(config, { meaConfig = 'meawallet/mea_config' } = {}) {
  return withXcodeProject(config, async (config) => {
    try {
      await access(meaConfig, constants.R_OK);
    } catch {
      console.warn(`MeaWallet: ${meaConfig} not found; skip adding to bundle. Add file from MeaWallet for MPP.`);
      return config;
    }
    const platformProjectRoot = config.modRequest.platformProjectRoot ?? path.join(config.modRequest.projectRoot, 'ios');
    const filepath = path.relative(platformProjectRoot, path.resolve(config.modRequest.projectRoot, meaConfig));
    IOSConfig.XcodeUtils.addResourceFileToGroup({
      filepath,
      groupName: 'Resources',
      project: config.modResults,
      isBuildFile: true,
      verbose: true,
    });
    console.log(`"${meaConfig}" added to iOS Xcode project as bundled Resource file`);
    return config;
  });
};
