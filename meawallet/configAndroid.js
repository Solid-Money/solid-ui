const { withDangerousMod } = require('@expo/config-plugins');
const { access, mkdir, copyFile, constants } = require('fs/promises');
const path = require('path');

/**
 * Expo config plugin: copies mea_config into android/app/src/main/res/raw for MeaWallet MPP.
 * Run expo prebuild to apply. Requires mea_config file from MeaWallet.
 */
module.exports = function withMeaConfigAndroid(config, { meaConfig = 'meawallet/mea_config' } = {}) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      try {
        await access(meaConfig, constants.R_OK);
      } catch {
        console.warn(`MeaWallet: ${meaConfig} not found; skip copying. Add file from MeaWallet for MPP.`);
        return config;
      }
      const projectRoot = config.modRequest.projectRoot;
      const platformProjectRoot = config.modRequest.platformProjectRoot ?? path.join(projectRoot, 'android');
      const rawFolder = path.join(platformProjectRoot, 'app', 'src', 'main', 'res', 'raw');
      await mkdir(rawFolder, { recursive: true });
      const dest = path.join(rawFolder, path.basename(meaConfig));
      await copyFile(meaConfig, dest);
      console.log(`"${meaConfig}" copied to Android raw resources "${rawFolder}"`);
      return config;
    },
  ]);
};
