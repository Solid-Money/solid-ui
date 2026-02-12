import * as Clipboard from 'expo-clipboard';
import { Linking, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { useIntercom as useIntercomHook } from 'react-use-intercom';

const SUPPORT_EMAIL = 'support@solid.xyz';

const nativeIntercomFallback = {
  show: () => openIntercom(),
  showNewMessage: () => openIntercom(),
  update: () => {},
};

export const useIntercom = () => {
  if (Platform.OS !== 'web') {
    return nativeIntercomFallback;
  }
  return useIntercomHook();
};

/**
 * Opens Intercom support chat on web, or falls back to email on mobile.
 * On native, if mailto: fails (e.g. no Mail app on simulator), copies email and shows toast.
 */
export const openIntercom = async () => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && (window as any).Intercom) {
      (window as any).Intercom('show');
    }
    return;
  }
  try {
    await Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  } catch {
    await Clipboard.setStringAsync(SUPPORT_EMAIL);
    Toast.show({ type: 'success', text1: 'Email copied', text2: SUPPORT_EMAIL, props: { badgeText: '' } });
  }
};
