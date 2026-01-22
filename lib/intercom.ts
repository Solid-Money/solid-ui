import { Linking, Platform } from 'react-native';
import { useIntercom as useIntercomHook } from 'react-use-intercom';

export const useIntercom = () => {
  if (Platform.OS !== 'web') {
    return null;
  }

  return useIntercomHook();
};

/**
 * Opens Intercom support chat on web, or falls back to email on mobile.
 * This is a global function that can be called from anywhere without hooks.
 */
export const openIntercom = () => {
  if (Platform.OS === 'web') {
    // On web, use the Intercom global API
    if (typeof window !== 'undefined' && (window as any).Intercom) {
      (window as any).Intercom('show');
    }
  } else {
    // On mobile, open email as fallback (Intercom not available natively)
    Linking.openURL('mailto:support@solid.xyz?subject=Card%20Verification%20Support');
  }
};
