import { useMemo } from 'react';
import Intercom from '@intercom/intercom-react-native';

import { IntercomAPI, IntercomUserAttributes } from '@/lib/intercom.types';

export const useIntercom = (): IntercomAPI => {
  return useMemo<IntercomAPI>(
    () => ({
      show: () => {
        Intercom.present();
      },
      showNewMessage: (message?: string) => {
        if (message) {
          Intercom.presentMessageComposer(message);
        } else {
          Intercom.present();
        }
      },
      update: (attributes: IntercomUserAttributes) => {
        Intercom.updateUser({
          userId: attributes.userId,
          name: attributes.name,
          email: attributes.email,
          customAttributes: attributes.customAttributes,
        });
      },
      shutdown: () => {
        Intercom.logout();
      },
      boot: () => {
        // No-op on native - SDK auto-boots via the Expo config plugin
        // The native Intercom SDK is initialized in AppDelegate/Application
      },
    }),
    [],
  );
};

/**
 * Opens Intercom support chat on native platforms.
 */
export const openIntercom = () => {
  Intercom.present();
};
