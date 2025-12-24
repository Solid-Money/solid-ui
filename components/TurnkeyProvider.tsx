import {
  EXPO_PUBLIC_TURNKEY_API_BASE_URL,
  EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
} from '@/lib/config';
import {
  type TurnkeyProviderConfig,
  StamperType,
  TurnkeyProvider as TurnkeyProviderKit,
} from '@turnkey/react-native-wallet-kit';
import { Platform } from 'react-native';

// Helper to get current hostname in runtime; falls back to configured value during SSR.
export const getRuntimeRpId = () => (Platform.OS === 'web' && __DEV__ ? 'localhost' : 'solid.xyz');

const TURNKEY_CONFIG: TurnkeyProviderConfig = {
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
  defaultStamperType: StamperType.Passkey,
};

export const TurnkeyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <TurnkeyProviderKit config={TURNKEY_CONFIG}>{children}</TurnkeyProviderKit>
);