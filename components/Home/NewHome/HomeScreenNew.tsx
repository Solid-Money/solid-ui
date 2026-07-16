import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Address } from 'viem';

import HomeVerificationCard from '@/components/Home/NewHome/HomeVerificationCard';
import HomeWalletCard from '@/components/Home/NewHome/HomeWalletCard';
import OtherBalancesDropdown from '@/components/Home/NewHome/OtherBalancesDropdown/OtherBalancesDropdown';
import WalletActions from '@/components/Home/NewHome/WalletActions';
import WalletBalanceHeadline from '@/components/Home/NewHome/WalletBalanceHeadline';
import PageLayout from '@/components/PageLayout';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { WalletInfo } from '@/components/Wallet';
import LazyWalletTabs from '@/components/Wallet/LazyWalletTabs';
import TokenListSkeleton from '@/components/Wallet/WalletTokenTab/TokenListSkeleton';
import { useUserTransactions } from '@/hooks/useAnalytics';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardStatus } from '@/hooks/useCardStatus';
import { MONITORED_COMPONENTS, useRenderMonitor } from '@/hooks/useRenderMonitor';
import { useTotalSavingsUSD } from '@/hooks/useTotalSavingsUSD';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { useIntercom } from '@/lib/intercom';
import { formatBalanceUSD, hasCard } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';

/**
 * Redesigned home/wallet screen (Apple "glass" style), shown only to whitelisted
 * internal users via the dispatcher in index(.native).tsx. Public users and all
 * desktop-web users keep LegacyHome.
 *
 * Big "Wallet Balance" number = wallet token balance (excludes soUSD/soFUSE).
 * Card + Savings live behind the OtherBalancesDropdown pill. The green card is
 * merged in here; Activity moved to the header bell.
 */
export default function HomeScreenNew() {
  useRenderMonitor({ componentName: MONITORED_COMPONENTS.HOME_SCREEN });

  const { user } = useUser();
  const queryClient = useQueryClient();
  const { data: balance, isLoading: isBalanceLoading } = useVaultBalance(
    user?.safeAddress as Address,
  );
  const updateUser = useUserStore(state => state.updateUser);
  const intercom = useIntercom();
  const { data: cardStatus } = useCardStatus();
  const { data: cardDetails } = useCardDetails();

  const userHasCard = hasCard(cardStatus);

  const {
    isLoading: isLoadingTokens,
    hasTokens,
    totalUSDExcludingVaultTokens,
    error: tokenError,
    retry: retryTokens,
    refresh: refreshTokens,
  } = useWalletTokens();

  // IMPORTANT: Guard to prevent infinite re-render loop (mirrors LegacyHome).
  // Only refresh tokens ONCE when balance first loads. DO NOT REMOVE — this
  // guard fixed the Sentry "Excessive renders in HomeScreen" bug.
  const hasTriggeredInitialRefresh = useRef(false);

  useEffect(() => {
    if (balance && !isBalanceLoading && !hasTriggeredInitialRefresh.current) {
      hasTriggeredInitialRefresh.current = true;
      // Avoid running the heavy multi-chain balance fetch twice at launch: the
      // protected layout already prefetched token balances, so only force a
      // refresh when that cached data is missing or stale.
      const state = queryClient.getQueryState(['tokenBalances', user?.safeAddress]);
      const isFresh = !!state?.data && Date.now() - state.dataUpdatedAt < 15_000;
      if (!isFresh) {
        refreshTokens();
      }
    }
  }, [balance, isBalanceLoading, refreshTokens, queryClient, user?.safeAddress]);

  // Reset when user changes (e.g., account switch) to allow fresh token sync.
  useEffect(() => {
    hasTriggeredInitialRefresh.current = false;
  }, [user?.safeAddress]);

  const { data: userDepositTransactions } = useUserTransactions(user?.safeAddress);
  const { data: totalSavingsUSD, isLoading: isTotalSavingsLoading } = useTotalSavingsUSD();

  const isDeposited = !!userDepositTransactions?.deposits?.length;
  const cardBalance = Number(cardDetails?.balances.available?.amount || '0');
  const depositCompleted = isDeposited || hasTokens || (balance ?? 0) > 0;

  useEffect(() => {
    if (!user) return;
    if (user.isDeposited === isDeposited) return;
    if (isDeposited) {
      updateUser({ ...user, isDeposited });
    }
  }, [isDeposited, user, updateUser]);

  useEffect(() => {
    if (!user || !intercom) return;
    intercom.update({
      userId: user.userId,
      name: user.username,
      email: user.email,
    });
  }, [user, intercom]);

  const isBalanceSectionLoading =
    isLoadingTokens || isBalanceLoading || isTotalSavingsLoading || totalSavingsUSD === undefined;
  const walletBalance = totalUSDExcludingVaultTokens;
  const savingsBalance = totalSavingsUSD ?? 0;
  const walletTitle = isBalanceSectionLoading ? null : formatBalanceUSD(walletBalance);
  const showAssets = isLoadingTokens || hasTokens || !!tokenError;

  return (
    <PageLayout mobileTitle={walletTitle}>
      <View className="mb-5 w-full gap-8 pb-24">
        {isBalanceSectionLoading ? (
          <View className="items-center gap-6 pt-6">
            <Skeleton className="h-16 w-48 rounded-xl" />
            <Skeleton className="h-9 w-32 rounded-full" />
            <Skeleton className="h-14 w-11/12 rounded-full" />
          </View>
        ) : (
          <View className="gap-5">
            <WalletBalanceHeadline balance={walletBalance} />
            <OtherBalancesDropdown
              cardBalance={cardBalance}
              savingsBalance={savingsBalance}
              userHasCard={userHasCard}
            />
            <WalletActions hasFunds={depositCompleted} />
          </View>
        )}

        <View className="gap-3 px-4">
          <HomeWalletCard hasCard={userHasCard} />
          {!userHasCard && <HomeVerificationCard depositCompleted={depositCompleted} />}
        </View>

        {showAssets && (
          <View className="gap-3 px-4">
            <Text className="text-lg font-semibold text-muted-foreground">Balances</Text>
            {tokenError ? (
              <View className="flex-1 items-center justify-center p-4">
                <WalletInfo text="Failed to load tokens" />
                <Text className="mt-2 text-sm text-muted-foreground">{tokenError}</Text>
                <TouchableOpacity
                  onPress={retryTokens}
                  className="mt-4 rounded-lg bg-primary px-4 py-2"
                >
                  <Text className="text-primary-foreground">Retry</Text>
                </TouchableOpacity>
              </View>
            ) : isLoadingTokens ? (
              <TokenListSkeleton />
            ) : (
              <LazyWalletTabs />
            )}
          </View>
        )}
      </View>
    </PageLayout>
  );
}
