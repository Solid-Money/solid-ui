import {
  EXPO_PUBLIC_TURNKEY_API_BASE_URL,
  EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
} from '@/lib/config';
import { base64urlToUint8Array } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';
import {
  type TurnkeyProviderConfig,
  TurnkeyProvider as TurnkeyProviderKit,
} from '@turnkey/react-native-wallet-kit';
import { useMemo } from 'react';
import { Platform } from 'react-native';

// Helper to get current hostname in runtime; falls back to configured value during SSR.
export const getRuntimeRpId = () =>
  Platform.OS === 'web' && __DEV__ ? 'localhost' : 'solid.xyz';

export const TurnkeyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Get the selected user's credentialId from the store
  const users = useUserStore(state => state.users);
  const selectedUser = users.find(u => u.selected);

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
    if (selectedUser?.credentialId) {
      const credentialIdBytes = base64urlToUint8Array(selectedUser.credentialId);
      baseConfig.passkeyConfig = {
        ...baseConfig.passkeyConfig,
        allowCredentials: [{
          id: credentialIdBytes as unknown as BufferSource,
          type: 'public-key' as const,
        }],
      };
    }

    return baseConfig;
  }, [selectedUser?.credentialId]);

  // Use key to force re-mount when credentialId changes
  // This ensures the SDK reinitializes with the new allowCredentials config
  return (
    <TurnkeyProviderKit
      key={selectedUser?.credentialId ?? 'no-credential'}
      config={config}
    >
      {children}
    </TurnkeyProviderKit>
  );
};
