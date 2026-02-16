import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Address } from 'viem';

import CountUp from '@/components/CountUp';
import { DashboardHeaderMobile } from '@/components/Dashboard';
import DashboardHeaderButtons from '@/components/Dashboard/DashboardHeaderButtons';
import LazyHomeBanners from '@/components/Dashboard/LazyHomeBanners';
import HomeEmptyState from '@/components/Home/EmptyState';
import PageLayout from '@/components/PageLayout';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { WalletInfo } from '@/components/Wallet';
import DesktopCards from '@/components/Wallet/DesktopCards';
import LazyWalletTabs from '@/components/Wallet/LazyWalletTabs';
import MobileCards from '@/components/Wallet/MobileCards';
import TokenListSkeleton from '@/components/Wallet/WalletTokenTab/TokenListSkeleton';
import { useUserTransactions } from '@/hooks/useAnalytics';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useDimension } from '@/hooks/useDimension';
import { MONITORED_COMPONENTS, useRenderMonitor } from '@/hooks/useRenderMonitor';
import { useTotalSavingsUSD } from '@/hooks/useTotalSavingsUSD';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { useIntercom } from '@/lib/intercom';
import { SavingMode } from '@/lib/types';
import { fontSize, hasCard } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';

export default function Home() {
  useRenderMonitor({ componentName: MONITORED_COMPONENTS.HOME_SCREEN });

  const { user } = useUser();
  const { isScreenMedium } = useDimension();
  const {
    data: balance,
    isLoading: isBalanceLoading,
    refetch: refetchBalance,
  } = useVaultBalance(user?.safeAddress as Address);
  const updateUser = useUserStore(state => state.updateUser);
  const intercom = useIntercom();
  const { data: cardStatus } = useCardStatus();
  const { data: cardDetails } = useCardDetails();

  const userHasCard = hasCard(cardStatus);

  const {
    isLoading: isLoadingTokens,
    hasTokens,
    totalUSDExcludingSoUSD,
    uniqueTokens,
    error: tokenError,
    retry: retryTokens,
    refresh: refreshTokens,
  } = useWalletTokens();

  // IMPORTANT: Guard to prevent infinite re-render loop
  // ─────────────────────────────────────────────────────────────────────────
  // Without this ref, the following cascade occurs:
  // 1. balance loads → useEffect calls refreshTokens()
  // 2. refreshTokens() invalidates queries → triggers re-render
  // 3. If refreshTokens reference changes → useEffect runs again → loop
  //
  // The ref ensures refreshTokens() only runs ONCE when balance first loads.
  // DO NOT REMOVE - this fixed Sentry error "Excessive renders in HomeScreen"
  // (12+ renders in ~1.6 seconds). See: useRenderMonitor.ts
  // ─────────────────────────────────────────────────────────────────────────
  const hasTriggeredInitialRefresh = useRef(false);

  useEffect(() => {
    if (balance && !isBalanceLoading && !hasTriggeredInitialRefresh.current) {
      hasTriggeredInitialRefresh.current = true;
      refreshTokens();
    }
  }, [balance, isBalanceLoading, refreshTokens]);

  // Reset when user changes (e.g., account switch) to allow fresh token sync
  useEffect(() => {
    hasTriggeredInitialRefresh.current = false;
  }, [user?.safeAddress]);

  const {
    data: userDepositTransactions,
    isLoading: isTransactionsLoading,
    refetch: refetchTransactions,
  } = useUserTransactions(user?.safeAddress);

  const { data: totalSavingsUSD, isLoading: isTotalSavingsLoading } = useTotalSavingsUSD();

  const topThreeTokens = uniqueTokens.slice(0, 3);
  const isDeposited = !!userDepositTransactions?.deposits?.length;

  const cardBalance = Number(cardDetails?.balances.available?.amount || '0');

  // SSE handles real-time updates; polling is fallback for SSE failure
  useEffect(() => {
    // 5-minute interval when balance exists; 10-minute fallback when no balance
    // (ensures new deposits are detected even if SSE is down)
    const intervalMs = balance && balance > 0 ? 5 * 60 * 1000 : 10 * 60 * 1000;

    const interval = setInterval(() => {
      refetchBalance();
      refetchTransactions();
    }, intervalMs);
    return () => clearInterval(interval);
  }, [balance, refetchBalance, refetchTransactions]);

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

  if (!balance && !isDeposited && !isBalanceLoading && !isTransactionsLoading && !hasTokens) {
    return <HomeEmptyState />;
  }

  // Note: We don't pass isLoading to PageLayout because we want the skeleton
  // fallbacks from LazyWalletTabs and LazyHomeBanners to be visible immediately.
  // This improves perceived performance - users see content structure right away.
  return (
    <PageLayout>
      <View className="mx-auto mb-5 w-full max-w-7xl gap-8 px-0 py-0 pb-20 md:gap-12 md:px-4 md:py-12">
        {isScreenMedium ? (
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="flex-row items-center gap-2">
                {isLoadingTokens ||
                isBalanceLoading ||
                isTotalSavingsLoading ||
                totalSavingsUSD === undefined ? (
                  <Skeleton className="h-[4.5rem] w-56 rounded-xl" />
                ) : (
                  <CountUp
                    prefix="$"
                    count={totalUSDExcludingSoUSD + (totalSavingsUSD ?? 0) + cardBalance}
                    isTrailingZero={false}
                    decimalPlaces={2}
                    classNames={{
                      wrapper: 'text-foreground',
                      decimalSeparator: 'text-2xl',
                    }}
                    styles={{
                      wholeText: {
                        fontSize: fontSize(3),
                        fontWeight: '600',
                        fontFamily: 'MonaSans_600SemiBold',
                        color: '#ffffff',
                        marginRight: -1,
                      },
                      decimalText: {
                        fontSize: fontSize(1.5),
                        fontWeight: '400',
                        fontFamily: 'MonaSans_400Regular',
                        color: '#ffffff',
                      },
                    }}
                  />
                )}
              </View>
            </View>
            <DashboardHeaderButtons hideWithdraw />
          </View>
        ) : isLoadingTokens ||
          isBalanceLoading ||
          isTotalSavingsLoading ||
          totalSavingsUSD === undefined ? (
          <View className="items-center pt-6">
            <Skeleton className="h-16 w-48 rounded-xl" />
            <View className="mt-8 flex-row justify-center gap-6">
              <Skeleton className="h-14 w-14 rounded-full" />
              <Skeleton className="h-14 w-14 rounded-full" />
              <Skeleton className="h-14 w-14 rounded-full" />
            </View>
          </View>
        ) : (
          <DashboardHeaderMobile
            balance={totalUSDExcludingSoUSD + (totalSavingsUSD ?? 0) + cardBalance}
            mode={SavingMode.BALANCE_ONLY}
          />
        )}
        {isScreenMedium ? (
          <DesktopCards
            totalUSDExcludingSoUSD={totalUSDExcludingSoUSD}
            topThreeTokens={topThreeTokens}
            isLoadingTokens={isLoadingTokens}
            userHasCard={userHasCard}
            cardBalance={cardBalance}
          />
        ) : (
          <MobileCards
            totalUSDExcludingSoUSD={totalUSDExcludingSoUSD}
            topThreeTokens={topThreeTokens}
            isLoadingTokens={isLoadingTokens}
            userHasCard={userHasCard}
            cardBalance={cardBalance}
          />
        )}

        <View className="mt-4 gap-3 px-4 md:px-0">
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
          ) : hasTokens ? (
            <LazyWalletTabs />
          ) : (
            <WalletInfo text="No tokens found" />
          )}
        </View>

        <View className="gap-6 px-4 md:mt-10 md:px-0">
          <Text className="text-lg font-semibold text-muted-foreground">Promotions</Text>
          <LazyHomeBanners />
        </View>
      </View>
    </PageLayout>
  );
}
