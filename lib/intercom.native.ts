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
        // presentMessageComposer is a native HostFunction: hand it anything other
        // than a string and it throws out of the bridge, which is a fatal,
        // unhandled crash rather than a failed chat. Callers upstream are typed
        // for a string but can still leak a press event, so re-check at the
        // boundary and fall back to opening Intercom without a prefilled message.
        if (typeof message === 'string' && message !== '') {
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
