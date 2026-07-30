const {
  withXcodeProject,
  withInfoPlist,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin: adds an iOS Notification Service Extension (NSE) so push
 * notifications can display the image sent by the backend
 * (apns.mutable-content + fcm_options.image / image). Without an NSE, iOS
 * delivers the image field but never renders it.
 *
 * Mirrors the repo's existing native-extension approach (meawallet/configIos.js
 * uses withXcodeProject) since ios/ is prebuild-generated, not committed — the
 * target must be (re)created on every `expo prebuild`. The extension is
 * dependency-free Swift (no Firebase pod in the extension): it reads the image
 * URL from the APNs payload, downloads it, and attaches it.
 *
 * The target is also registered for EAS signing via
 * extra.eas.build.experimental.ios.appExtensions in app.config.ts.
 *
 * Validate with `expo prebuild -p ios` + an EAS dev build; rich-push image
 * rendering cannot be verified in JS/unit tests.
 */

const DEFAULT_TARGET_NAME = 'SolidNotificationService';
const DEFAULT_DEPLOYMENT_TARGET = '15.1';

const NOTIFICATION_SERVICE_SWIFT = `import UserNotifications

/// Downloads the image referenced by the push payload and attaches it so iOS
/// renders a rich notification. The backend sends apns.mutable-content = 1 and
/// the URL under fcm_options.image (FCM) — we also accept a top-level "image".
class NotificationService: UNNotificationServiceExtension {
  var contentHandler: ((UNNotificationContent) -> Void)?
  var bestAttemptContent: UNMutableNotificationContent?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    self.contentHandler = contentHandler
    bestAttemptContent = request.content.mutableCopy() as? UNMutableNotificationContent

    guard let bestAttemptContent = bestAttemptContent else {
      contentHandler(request.content)
      return
    }

    let userInfo = request.content.userInfo
    let imageUrlString =
      (userInfo["fcm_options"] as? [String: Any])?["image"] as? String
      ?? userInfo["image"] as? String

    guard let imageUrlString = imageUrlString,
          let imageUrl = URL(string: imageUrlString) else {
      contentHandler(bestAttemptContent)
      return
    }

    let task = URLSession.shared.downloadTask(with: imageUrl) { location, response, _ in
      defer { contentHandler(bestAttemptContent) }
      guard let location = location else { return }

      // Preserve a file extension so iOS can infer the attachment type.
      let suggested = response?.suggestedFilename ?? imageUrl.lastPathComponent
      var ext = (suggested as NSString).pathExtension
      if ext.isEmpty { ext = "png" }
      let tmpUrl = URL(fileURLWithPath: NSTemporaryDirectory())
        .appendingPathComponent(UUID().uuidString)
        .appendingPathExtension(ext)

      do {
        try FileManager.default.moveItem(at: location, to: tmpUrl)
        let attachment = try UNNotificationAttachment(identifier: "image", url: tmpUrl, options: nil)
        bestAttemptContent.attachments = [attachment]
      } catch {
        // Fall through: deliver the text-only notification.
      }
    }
    task.resume()
  }

  override func serviceExtensionTimeWillExpire() {
    if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
      contentHandler(bestAttemptContent)
    }
  }
}
`;

function buildInfoPlist(targetName) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>${targetName}</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
  <key>CFBundleShortVersionString</key>
  <string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key>
  <string>$(CURRENT_PROJECT_VERSION)</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.usernotifications.service</string>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).NotificationService</string>
  </dict>
</dict>
</plist>
`;
}

/**
 * Keep the extension embed phase ahead of scripts that mutate the containing
 * app's Info.plist. Xcode 26 otherwise detects a dependency cycle between the
 * app-extension copy command and the Firebase/Expo script phases.
 */
function orderNotificationServiceEmbedPhase(proj, targetName) {
  const objects = proj.hash.project.objects;
  const targets = objects.PBXNativeTarget ?? {};
  const copyPhases = objects.PBXCopyFilesBuildPhase ?? {};

  const appTarget = Object.entries(targets).find(
    ([key, target]) =>
      !key.endsWith('_comment') &&
      target?.productType === '"com.apple.product-type.application"',
  )?.[1];
  if (!appTarget?.buildPhases) return;

  const copyPhaseIndex = appTarget.buildPhases.findIndex((phaseRef) => {
    const phase = copyPhases[phaseRef.value];
    return phase?.files?.some((file) =>
      file.comment?.includes(`${targetName}.appex`),
    );
  });
  if (copyPhaseIndex < 0) return;

  const firstInfoPlistScriptIndex = appTarget.buildPhases.findIndex(
    (phaseRef) =>
      phaseRef.comment?.includes('[CP-User] [RNFB] Core Configuration') ||
      phaseRef.comment?.includes(
        '[Expo Dev Launcher] Strip Local Network Keys for Release',
      ),
  );
  if (
    firstInfoPlistScriptIndex < 0 ||
    copyPhaseIndex < firstInfoPlistScriptIndex
  ) {
    return;
  }

  const [copyPhase] = appTarget.buildPhases.splice(copyPhaseIndex, 1);
  appTarget.buildPhases.splice(firstInfoPlistScriptIndex, 0, copyPhase);
}

/** Keep the extension's identity and version aligned with the containing app. */
function configureNotificationServiceBuildSettings(proj, options) {
  const {
    targetName,
    bundleIdentifier,
    deploymentTarget,
    appleTeamId,
    marketingVersion,
    currentProjectVersion,
  } = options;
  const objects = proj.hash.project.objects;
  const target = Object.entries(objects.PBXNativeTarget ?? {}).find(
    ([key, nativeTarget]) =>
      !key.endsWith('_comment') &&
      nativeTarget?.name?.replaceAll('"', '') === targetName,
  )?.[1];
  if (!target) return;

  const configurationList =
    objects.XCConfigurationList?.[target.buildConfigurationList];
  for (const configurationRef of configurationList?.buildConfigurations ??
    []) {
    const buildSettings =
      objects.XCBuildConfiguration?.[configurationRef.value]?.buildSettings;
    if (!buildSettings) continue;

    buildSettings.INFOPLIST_FILE = `"${targetName}/Info.plist"`;
    buildSettings.PRODUCT_BUNDLE_IDENTIFIER = `"${bundleIdentifier}"`;
    buildSettings.PRODUCT_NAME = `"${targetName}"`;
    buildSettings.CURRENT_PROJECT_VERSION = `${currentProjectVersion}`;
    buildSettings.MARKETING_VERSION = `${marketingVersion}`;
    buildSettings.SWIFT_VERSION = '5.0';
    buildSettings.IPHONEOS_DEPLOYMENT_TARGET = `"${deploymentTarget}"`;
    buildSettings.TARGETED_DEVICE_FAMILY = '"1,2"';
    buildSettings.CODE_SIGN_STYLE = 'Automatic';
    buildSettings.CLANG_ENABLE_MODULES = 'YES';
    if (configurationRef.comment === 'Debug') {
      buildSettings.SWIFT_OPTIMIZATION_LEVEL = '"-Onone"';
    }
    if (appleTeamId) {
      buildSettings.DEVELOPMENT_TEAM = `"${appleTeamId}"`;
    }
  }
}

/**
 * Create the NSE target in the generated Xcode project and embed it in the app.
 * Idempotent: a re-run keeps the target and repairs its embed-phase ordering.
 */
function addNotificationServiceTarget(config, options) {
  const { targetName, bundleIdentifier, deploymentTarget, appleTeamId } =
    options;

  return withXcodeProject(config, (config) => {
    const proj = config.modResults;

    // Idempotency: skip if the target already exists.
    const existing = proj.pbxTargetByName
      ? proj.pbxTargetByName(targetName)
      : undefined;
    if (existing) {
      configureNotificationServiceBuildSettings(proj, options);
      orderNotificationServiceEmbedPhase(proj, targetName);
      return config;
    }

    const iosRoot = config.modRequest.platformProjectRoot;
    const extDir = path.join(iosRoot, targetName);
    fs.mkdirSync(extDir, { recursive: true });
    fs.writeFileSync(
      path.join(extDir, 'NotificationService.swift'),
      NOTIFICATION_SERVICE_SWIFT,
    );
    fs.writeFileSync(
      path.join(extDir, 'Info.plist'),
      buildInfoPlist(targetName),
    );

    // 1. Create the app-extension native target (also creates its product ref
    //    and a Debug/Release XCConfigurationList).
    const target = proj.addTarget(
      targetName,
      'app_extension',
      targetName,
      bundleIdentifier,
    );

    // 2. Source group + files for the extension (before build phases so the
    //    file references are reused, not duplicated).
    const group = proj.addPbxGroup(
      ['NotificationService.swift', 'Info.plist'],
      targetName,
      targetName,
    );

    // 3. Build phases for the new target.
    proj.addBuildPhase(
      ['NotificationService.swift'],
      'PBXSourcesBuildPhase',
      'Sources',
      target.uuid,
    );
    proj.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    proj.addBuildPhase(
      [],
      'PBXFrameworksBuildPhase',
      'Frameworks',
      target.uuid,
    );

    // Nest the new group under the main project group.
    const groups = proj.hash.project.objects.PBXGroup;
    Object.keys(groups).forEach((key) => {
      if (
        typeof groups[key] === 'object' &&
        groups[key].name === undefined &&
        groups[key].path === undefined &&
        Array.isArray(groups[key].children)
      ) {
        groups[key].children.push({ value: group.uuid, comment: targetName });
      }
    });

    // 4. Per-configuration build settings for the new target.
    configureNotificationServiceBuildSettings(proj, options);
    orderNotificationServiceEmbedPhase(proj, targetName);
    return config;
  });
}

/** Ensure the main app declares the remote-notification background mode. */
function withRemoteNotificationBackgroundMode(config) {
  return withInfoPlist(config, (config) => {
    const modes = config.modResults.UIBackgroundModes ?? [];
    if (!modes.includes('remote-notification')) {
      config.modResults.UIBackgroundModes = [...modes, 'remote-notification'];
    }
    return config;
  });
}

module.exports = function withIosNotificationServiceExtension(config, props = {}) {
  const targetName = props.targetName ?? DEFAULT_TARGET_NAME;
  const bundleIdentifier =
    props.bundleIdentifier ??
    `${config.ios?.bundleIdentifier ?? 'app.solid.xyz'}.${targetName}`;
  const deploymentTarget =
    props.deploymentTarget ?? DEFAULT_DEPLOYMENT_TARGET;
  const appleTeamId = props.appleTeamId ?? config.ios?.appleTeamId;
  const marketingVersion = config.version ?? '1.0';
  const currentProjectVersion = config.ios?.buildNumber ?? '1';

  config = withRemoteNotificationBackgroundMode(config);
  config = addNotificationServiceTarget(config, {
    targetName,
    bundleIdentifier,
    deploymentTarget,
    appleTeamId,
    marketingVersion,
    currentProjectVersion,
  });
  return config;
};

module.exports.DEFAULT_TARGET_NAME = DEFAULT_TARGET_NAME;
