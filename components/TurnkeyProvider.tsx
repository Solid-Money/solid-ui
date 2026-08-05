import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import {
  TurnkeyProvider as TurnkeyProviderKit,
  type TurnkeyProviderConfig,
} from '@turnkey/react-native-wallet-kit';
import { useShallow } from 'zustand/react/shallow';

import {
  EXPO_PUBLIC_TURNKEY_API_BASE_URL,
  EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
} from '@/lib/config';
import { base64urlToUint8Array } from '@/lib/utils';
import { selectSelectedCredentialId, useUserStore } from '@/store/useUserStore';

// Helper to get current hostname in runtime; falls back to configured value during SSR.
export const getRuntimeRpId = () => (Platform.OS === 'web' && __DEV__ ? 'localhost' : 'solid.xyz');

export const TurnkeyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const selectedCredentialId = useUserStore(useShallow(selectSelectedCredentialId));

  // The credential the mounted SDK client was built with. The kit bakes
  // allowCredentials into its client on first init and never re-reads it, so the
  // only way to change the filter is to re-mount this provider — which throws
  // away the whole React tree below it, including any screen state mid-flow.
  //
  // A credential arriving where there was none means a login/signup just stored
  // its user, and that happens well before the flow navigates away: remounting
  // there tore down the onboarding welcome sheet and flashed the landing screen
  // back mid-login. That case is deferred to the next app launch (the client is
  // already live and an unfiltered prompt still works). Account switches and
  // logouts still re-mount — they unwind the UI anyway, and the prompt must not
  // keep offering the previous account's passkey.
  const [activeCredentialId, setActiveCredentialId] = useState(selectedCredentialId);

  useEffect(() => {
    setActiveCredentialId(current => {
      if (current === selectedCredentialId) return current;
      if (!current && selectedCredentialId) return current;
      return selectedCredentialId;
    });
  }, [selectedCredentialId]);

  const config = useMemo<TurnkeyProviderConfig>(() => {
    const baseConfig: TurnkeyProviderConfig = {
      organizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
      apiBaseUrl: EXPO_PUBLIC_TURNKEY_API_BASE_URL,
      passkeyConfig: {
        rpId: getRuntimeRpId(),
      },
      auth: {
        passkey: true,
        // We manage sessions via our backend, so disable SDK session management
        autoRefreshSession: false,
      },
    };

    // If we have a credentialId, add it to allowCredentials
    // This filters the passkey prompt to only show the user's registered passkey
    //
    // Format handling:
    // - credentialId is stored as base64url (from passkey creation)
    // - Web: SDK passes Uint8Array directly to WebAuthn API
    // - React Native: SDK converts Uint8Array to hex string for react-native-passkey
    if (activeCredentialId) {
      const credentialIdBytes = base64urlToUint8Array(activeCredentialId);
      baseConfig.passkeyConfig = {
        ...baseConfig.passkeyConfig,
        allowCredentials: [
          {
            id: credentialIdBytes as unknown as BufferSource,
            type: 'public-key' as const,
          },
        ],
      };
    }

    return baseConfig;
  }, [activeCredentialId]);

  // Keyed so the SDK reinitializes with the new allowCredentials config whenever
  // the active credential changes (see the note above for which changes qualify).
  return (
    <TurnkeyProviderKit key={activeCredentialId ?? 'no-credential'} config={config}>
      {children}
    </TurnkeyProviderKit>
  );
};
