import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, InteractionManager, Platform, StyleSheet, View } from 'react-native';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Address } from 'viem';
import { fuse, mainnet } from 'viem/chains';
import { readContractQueryOptions } from 'wagmi/query';
import { useShallow } from 'zustand/react/shallow';

import {
  BridgeTransferCryptoCurrency,
  BridgeTransferFiatCurrency,
} from '@/components/BankTransfer/enums';
import CardHeroOverlay from '@/components/Card/NewCardDetails/CardHeroOverlay';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { useActivitySSE } from '@/hooks/useActivitySSE';
import { apysQueryOptions } from '@/hooks/useAnalytics';
import { tokenBalancesQueryOptions } from '@/hooks/useBalances';
import { detectPasskeySupported } from '@/hooks/usePasskey';
import { usePostSignupInit } from '@/hooks/usePostSignupInit';
import useUser from '@/hooks/useUser';
import { useWebhookStatus } from '@/hooks/useWebhookStatus';
import FuseVault from '@/lib/abis/FuseVault';
import { trackIdentity } from '@/lib/analytics';
import { ADDRESSES } from '@/lib/config';
import { config } from '@/lib/wagmi';
import { useDepositStore } from '@/store/useDepositStore';
import { useUserStore } from '@/store/useUserStore';

// Lazy load Loading component - only used during hydration
const Loading = lazy(() => import('@/components/Loading'));

export default function ProtectedLayout() {
  const { user } = useUser();
  const { usersCount, _hasHydrated } = useUserStore(
    useShallow(state => ({ usersCount: state.users.length, _hasHydrated: state._hasHydrated })),
  );
  const searchParams = useLocalSearchParams();
  const queryClient = useQueryClient();

  // Defer non-critical startup work (webhook auto-subscribe, MeaWallet init)
  // until after the first interactions so it doesn't compete with first paint.
  const [startupDeferred, setStartupDeferred] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setStartupDeferred(true));
    return () => task.cancel();
  }, []);

  useEffect(() => {
    if (!user?.safeAddress) return;

    const safeAddress = user.safeAddress as Address;

    queryClient.prefetchQuery(
      readContractQueryOptions(config, {
        abi: FuseVault,
        address: ADDRESSES.fuse.vault,
        functionName: 'balanceOf',
        args: [safeAddress],
        chainId: fuse.id,
      }),
    );
    queryClient.prefetchQuery(
      readContractQueryOptions(config, {
        abi: FuseVault,
        address: ADDRESSES.ethereum.vault,
        functionName: 'balanceOf',
        args: [safeAddress],
        chainId: mainnet.id,
      }),
    );

    queryClient.prefetchQuery(tokenBalancesQueryOptions(safeAddress));
    queryClient.prefetchQuery(apysQueryOptions());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.safeAddress]);

  // Run post-signup/login initialization (lazy loading of balance, points, etc.)
  usePostSignupInit(user);

  // Ensure webhook subscription for real-time activity updates
  // This auto-subscribes when user has a safe address but isn't registered yet.
  // Deferred until after first paint so the subscribe POST doesn't compete with
  // startup data loading (the status fetch itself still runs immediately).
  useWebhookStatus({ autoSubscribe: startupDeferred });

  // Enable real-time activity updates globally for logged-in users
  useActivitySSE({ enabled: !!user, subscribe: false });

  // MeaWallet MPP: initialize once on native (required before any MPP API use).
  // Deferred off the first-paint critical path — MPP isn't needed at startup.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const task = InteractionManager.runAfterInteractions(() => {
      import('@meawallet/react-native-mpp')
        .then(m => m.default.initialize().catch(() => {}))
        .catch(() => {});
    });
    return () => task.cancel();
  }, []);

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
    if (Boolean(detectPasskeySupported())) return <Redirect href={path.PASSKEY_NOT_SUPPORTED} />;
  }

  // Wait for Zustand store to hydrate before making redirect decisions
  // This prevents incorrect redirects when users array is empty during hydration
  // Show loading state to improve FCP (vs returning null which blocks paint)
  if (!_hasHydrated) {
    return (
      <Suspense
        fallback={
          <View className="h-full flex-1 items-center justify-center bg-background">
            <ActivityIndicator size="large" color="#cccccc" />
          </View>
        }
      >
        <Loading />
      </Suspense>
    );
  }

  if (!usersCount) {
    // Show onboarding first (if not seen), then signup flow
    return <Redirect href={path.ONBOARDING} />;
  }

  if (usersCount && !user) {
    return <Redirect href={path.WELCOME} />;
  }

  return (
    <View style={styles.root}>
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
        <Stack.Screen
          name="coins/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="deposit"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="qr-scanner"
          options={{
            headerShown: false,
            animation: 'slide_from_bottom',
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="rescue-token"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="agent/index"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="gooddollar/index"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
      {/* Root-level hero overlay for the card view-transition (whitelisted new
          screens only — stays dormant/null otherwise). Mounted above the whole
          navigator so the card can fly across the home → card/details change. */}
      <CardHeroOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
