import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as browserDetection from '@braintree/browser-detection';

const browserName = (): string | null => {
  // Order matters: Edge, Opera and Samsung Internet all say "Chrome" too.
  if (browserDetection.isEdge()) return 'Edge';
  if (browserDetection.isOpera()) return 'Opera';
  if (browserDetection.isSamsungBrowser()) return 'Samsung Internet';
  if (browserDetection.isFirefox()) return 'Firefox';
  if (browserDetection.isChrome()) return 'Chrome';
  if (browserDetection.isSafari()) return 'Safari';
  return null;
};

const systemName = (): string | null => {
  const os = Device.osName ?? '';
  if (/mac/i.test(os)) return 'Mac';
  if (/windows/i.test(os)) return 'Windows';
  if (/chrom/i.test(os)) return 'ChromeOS';
  if (/ios/i.test(os)) return Device.deviceType === Device.DeviceType.TABLET ? 'iPad' : 'iPhone';
  if (/android/i.test(os)) return 'Android';
  if (/linux/i.test(os)) return 'Linux';
  return null;
};

/**
 * What to call a passkey created on this device until the user renames it: the
 * phone's model on iOS and Android ("iPhone 15 Pro", "Pixel 9a"), the browser
 * and system on the web ("Chrome on Mac").
 *
 * A best guess. The system sheet lets the user save the passkey to a security
 * key or to a phone over QR instead, and nothing tells us which they chose —
 * hence Rename.
 */
export const getPasskeyDeviceLabel = (): string => {
  if (Platform.OS !== 'web') {
    return Device.modelName ?? (Platform.OS === 'ios' ? 'iPhone' : 'Android phone');
  }

  const browser = browserName();
  const system = systemName();
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? 'Browser';
};

/** This device as the user would name it in a sentence: "this iPhone". */
export const getThisDeviceNoun = (): string => {
  if (Platform.OS === 'ios') {
    return Device.deviceType === Device.DeviceType.TABLET ? 'this iPad' : 'this iPhone';
  }
  if (Platform.OS === 'android') {
    return Device.deviceType === Device.DeviceType.TABLET ? 'this tablet' : 'this phone';
  }
  return 'this device';
};
