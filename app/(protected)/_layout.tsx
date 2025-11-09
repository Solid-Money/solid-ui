import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

import {
  BridgeTransferCryptoCurrency,
  BridgeTransferFiatCurrency,
} from '@/components/BankTransfer/enums';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { detectPasskeySupported } from '@/hooks/usePasskey';
import { usePostSignupInit } from '@/hooks/usePostSignupInit';
import useUser from '@/hooks/useUser';
import { trackIdentity } from '@/lib/analytics';
import { useDepositStore } from '@/store/useDepositStore';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { useUserStore } from '@/store/useUserStore';

export default function ProtectedLayout() {
  const { user } = useUser();
  const { users } = useUserStore();
  const { hasSeenOnboarding } = useOnboardingStore();
  const searchParams = useLocalSearchParams();

  // Run post-signup/login initialization (lazy loading of balance, points, etc.)
  usePostSignupInit(user);

  useEffect(() => {
    if (!user) return;

    trackIdentity(user.userId, {
      username: user.username,
      email: user.email,
    });
  }, [user]);

  const resumeParams =
    Platform.OS === 'web'
      ? new URLSearchParams(window.location.search).get('resumeParams')
      : searchParams.resumeParams;

  // This is used to resume the bank transfer flow
  // after the user returns from KYC
  const handleResumeBankTransferParams = useCallback((params: string) => {
    try {
      const decodedParams = decodeURIComponent(params);

      const parsedParams = decodedParams.split(',').reduce<Record<string, string>>((acc, pair) => {
        const [key, value] = pair.split(':');
        acc[key] = value;
        return acc;
      }, {});

      const { fiat, crypto, fiatAmount, method } = parsedParams;

      if (fiat && crypto && fiatAmount && method) {
        const { setBankTransferData, setModal } = useDepositStore.getState();
        setBankTransferData({
          fiat: fiat.toLowerCase() as BridgeTransferFiatCurrency,
          crypto: crypto.toLowerCase() as BridgeTransferCryptoCurrency,
          fiatAmount,
          method: method.toLowerCase(),
        });
        setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_AMOUNT);
      }
    } catch (error) {
      console.error('Error parsing resumeParams:', error);
    }
  }, []);

  useEffect(() => {
    if (resumeParams && typeof resumeParams === 'string') {
      handleResumeBankTransferParams(resumeParams);
    }
  }, [resumeParams, handleResumeBankTransferParams]);

  if (Platform.OS === 'web') {
    // Since we wait for passkey check in root layout, this should never be null
    if (detectPasskeySupported() === false) return <Redirect href={path.PASSKEY_NOT_SUPPORTED} />;
  }

  if (!users.length) {
    // Show onboarding on native platforms (only if not seen before), and register on web
    if (Platform.OS === 'web') {
      return <Redirect href={path.REGISTER} />;
    } else {
      // On native, show onboarding first time, then register
      return <Redirect href={hasSeenOnboarding ? path.REGISTER : path.ONBOARDING} />;
    }
  }

  if (users.length && !user) {
    return <Redirect href={path.WELCOME} />;
  }

  return (
    <Stack
      screenOptions={{
        contentStyle: {
          backgroundColor: '#000',
        },
        headerStyle: {
          backgroundColor: '#000',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="(tabs)"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="quest-wallet"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
