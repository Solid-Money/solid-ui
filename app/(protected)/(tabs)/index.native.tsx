import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Address } from 'viem';

import { DashboardHeaderMobile } from '@/components/Dashboard';
import LazyHomeBanners from '@/components/Dashboard/LazyHomeBanners';
import HomeCashbackCard from '@/components/Home/HomeCashbackCard';
import HomeSavingsStatCard from '@/components/Home/HomeSavingsStatCard';
import HomeVirtualCard from '@/components/Home/HomeVirtualCard';
import HomeScreenNew from '@/components/Home/NewHome/HomeScreenNew';
import PageLayout from '@/components/PageLayout';
import SpinWinCard from '@/components/SpinAndWin/SpinWinCard';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { WalletInfo } from '@/components/Wallet';
import LazyWalletTabs from '@/components/Wallet/LazyWalletTabs';
import TokenListSkeleton from '@/components/Wallet/WalletTokenTab/TokenListSkeleton';
import { SPIN_WIN_MODAL } from '@/constants/modals';
import { useUserTransactions } from '@/hooks/useAnalytics';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useCurrentGiveaway, useGiveawayCountdown } from '@/hooks/useGiveaway';
import { MONITORED_COMPONENTS, useRenderMonitor } from '@/hooks/useRenderMonitor';
import { useSpinStatus } from '@/hooks/useSpinWin';
import { useTotalSavingsUSD } from '@/hooks/useTotalSavingsUSD';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { useIntercom } from '@/lib/intercom';
import { SavingMode } from '@/lib/types';
import { formatBalanceUSD, hasCard } from '@/lib/utils';
import { useSpinWinModalStore } from '@/store/useSpinWinModalStore';
import { useUserStore } from '@/store/useUserStore';

/**
 * Native home screen.
 *
 * Web keeps its own layout in `index.tsx`; this `.native.tsx` variant is used on
 * iOS/Android only (resolved by Metro).
 *
 * qa/preview builds see the redesigned `HomeScreenNew`; production keeps this
 * `LegacyHome`. The gate lives in the default export below.
 */
function LegacyHome() {
  useRenderMonitor({ componentName: MONITORED_COMPONENTS.HOME_SCREEN });

  const { user } = useUser();
  const queryClient = useQueryClient();
  const { data: balance, isLoading: isBalanceLoading } = useVaultBalance(
    user?.safeAddress as Address,
  );
  const updateUser = useUserStore(state => state.updateUser);
  const openSpinWinModal = useSpinWinModalStore(state => state.setModal);
  const intercom = useIntercom();
  const { data: cardStatus } = useCardStatus();
  const { data: cardDetails } = useCardDetails();
  const { data: spinStatus } = useSpinStatus();
  const { data: giveaway } = useCurrentGiveaway();
  const countdown = useGiveawayCountdown(giveaway?.giveawayDate);

  const userHasCard = hasCard(cardStatus);

  const {
    isLoading: isLoadingTokens,
    hasTokens,
    totalUSDExcludingVaultTokens,
    error: tokenError,
    retry: retryTokens,
    refresh: refreshTokens,
  } = useWalletTokens();

  // IMPORTANT: Guard to prevent infinite re-render loop (mirrors index.tsx).
  // Only refresh tokens ONCE when balance first loads.
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

  // Reset when user changes (e.g., account switch) to allow fresh token sync
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
  const headlineBalance = totalUSDExcludingVaultTokens + (totalSavingsUSD ?? 0) + cardBalance;
  const mobileHeaderBalance = isBalanceSectionLoading ? null : formatBalanceUSD(headlineBalance);
  const showAssets = isLoadingTokens || hasTokens || !!tokenError;

  return (
    <PageLayout mobileTitle={mobileHeaderBalance}>
      <View className="mb-5 w-full gap-8 pb-20">
        {isBalanceSectionLoading ? (
          <View className="items-center pt-6">
            <Skeleton className="h-16 w-48 rounded-xl" />
            <View className="mt-8 flex-row justify-center gap-6">
              <Skeleton className="h-14 w-14 rounded-full" />
              <Skeleton className="h-14 w-14 rounded-full" />
              <Skeleton className="h-14 w-14 rounded-full" />
            </View>
          </View>
        ) : (
          <DashboardHeaderMobile balance={headlineBalance} mode={SavingMode.BALANCE_ONLY} />
        )}

        <View className="gap-3 px-4">
          <HomeVirtualCard
            userHasCard={userHasCard}
            cardBalance={cardBalance}
            depositCompleted={depositCompleted}
            isLoading={isLoadingTokens}
          />
          <View className="flex-row items-start gap-3">
            <HomeCashbackCard />
            <HomeSavingsStatCard />
          </View>
        </View>

        {showAssets && (
          <View className="gap-3 px-4">
            <Text className="text-lg font-semibold text-muted-foreground">Assets</Text>
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

        <View className="gap-3 px-4">
          <Text className="mb-2 text-lg font-semibold text-muted-foreground">Promotions</Text>
          {spinStatus?.isAllowed && (
            <SpinWinCard
              currentStreak={spinStatus?.currentStreak ?? 0}
              spinAvailable={spinStatus?.spinAvailableToday ?? true}
              lastSpinDate={spinStatus?.lastSpinDate ?? null}
              prizePool={giveaway?.prizePool}
              giveawayCountdown={countdown}
              onPress={() => openSpinWinModal(SPIN_WIN_MODAL.OPEN_HOME)}
            />
          )}
          <LazyHomeBanners />
        </View>
      </View>
    </PageLayout>
  );
}

export default function Home() {
  // qa/preview builds see the redesigned wallet screen; production keeps the
  // existing design. Native is never desktop.
  return <HomeScreenNew /> ;
}
