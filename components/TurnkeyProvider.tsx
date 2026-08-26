import { useMemo } from 'react';
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
import { tryBase64urlToUint8Array } from '@/lib/utils';
import { selectSelectedCredentialIds, useUserStore } from '@/store/useUserStore';

// Helper to get current hostname in runtime; falls back to configured value during SSR.
export const getRuntimeRpId = () => (Platform.OS === 'web' && __DEV__ ? 'localhost' : 'solid.xyz');

export const TurnkeyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const selectedCredentialIds = useUserStore(useShallow(selectSelectedCredentialIds));

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

    // Filter the passkey prompt to the credentials this account can present.
    //
    // All of them, not just the most recent: passkey recovery adds an
    // authenticator rather than replacing the lost one, so an account can hold
    // several and only the device knows which it has. Listing them all keeps
    // the prompt a single tap — the authenticator silently picks the one it
    // holds — where listing one strands every in-app action whenever that one
    // is not it.
    //
    // Format handling:
    // - credentialIds are stored as base64url (from passkey creation)
    // - Web: SDK passes Uint8Array directly to WebAuthn API
    // - React Native: SDK converts Uint8Array to base64url for react-native-passkey
    //   (see patches/@turnkey+core+1.14.1.patch — upstream sends hex, which
    //   never matches, so a version bump that drops the patch re-breaks this)
    const allowCredentials = selectedCredentialIds
      .map(credentialId => tryBase64urlToUint8Array(credentialId))
      .filter((bytes): bytes is Uint8Array => !!bytes)
      .map(bytes => ({ id: bytes as unknown as BufferSource, type: 'public-key' as const }));

    if (allowCredentials.length) {
      baseConfig.passkeyConfig = { ...baseConfig.passkeyConfig, allowCredentials };
    }

    return baseConfig;
  }, [selectedCredentialIds]);

  // Use key to force re-mount when the credential set changes
  // This ensures the SDK reinitializes with the new allowCredentials config
  return (
    <TurnkeyProviderKit key={selectedCredentialIds.join(',') || 'no-credential'} config={config}>
      {children}
    </TurnkeyProviderKit>
  );
};
