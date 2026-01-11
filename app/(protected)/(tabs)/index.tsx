import CountUp from '@/components/CountUp';
import { DashboardHeaderMobile } from '@/components/Dashboard';
import DashboardHeaderButtons from '@/components/Dashboard/DashboardHeaderButtons';
import { HomeBanners } from '@/components/Dashboard/HomeBanners';
import PageLayout from '@/components/PageLayout';
import SavingsEmptyState from '@/components/Savings/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { WalletInfo } from '@/components/Wallet';
import DesktopCards from '@/components/Wallet/DesktopCards';
import MobileCards from '@/components/Wallet/MobileCards';
import WalletTabs from '@/components/Wallet/WalletTabs';
import { useAPYs, useLatestTokenTransfer, useUserTransactions } from '@/hooks/useAnalytics';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useDepositCalculations } from '@/hooks/useDepositCalculations';
import { useDimension } from '@/hooks/useDimension';
import { useCalculateSavings } from '@/hooks/useFinancial';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { ADDRESSES } from '@/lib/config';
import { useIntercom } from '@/lib/intercom';
import { SavingMode } from '@/lib/types';
import { fontSize, hasCard } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';
import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Address } from 'viem';

export default function Home() {
  const { user } = useUser();
  const { isScreenMedium } = useDimension();
  const {
    data: balance,
    isLoading: isBalanceLoading,
    refetch: refetchBalance,
  } = useVaultBalance(user?.safeAddress as Address);
  const { updateUser } = useUserStore();
  const intercom = useIntercom();
  const { data: cardStatus } = useCardStatus();
  const { data: cardDetails } = useCardDetails();

  const userHasCard = hasCard(cardStatus);

  // Controlled timestamp state - updates every 30 seconds instead of every render
  const [currentTime, setCurrentTime] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const { data: apys, isLoading: isAPYsLoading } = useAPYs();
  const {
    isLoading: isLoadingTokens,
    hasTokens,
    totalUSDExcludingSoUSD,
    uniqueTokens,
    error: tokenError,
    retry: retryTokens,
    refresh: refreshTokens,
  } = useWalletTokens();
  const { data: lastTimestamp } = useLatestTokenTransfer(
    user?.safeAddress ?? '',
    ADDRESSES.fuse.vault,
  );

  useEffect(() => {
    if (balance && !isBalanceLoading) {
      refreshTokens();
    }
  }, [balance, isBalanceLoading, refreshTokens]);

  const {
    data: userDepositTransactions,
    isLoading: isTransactionsLoading,
    refetch: refetchTransactions,
  } = useUserTransactions(user?.safeAddress);

  const { firstDepositTimestamp } = useDepositCalculations(
    userDepositTransactions,
    balance,
    lastTimestamp,
  );

  const { savings } = useCalculateSavings(
    balance ?? 0,
    apys?.allTime ?? 0,
    firstDepositTimestamp ?? 0,
    currentTime,
    SavingMode.TOTAL_USD,
    userDepositTransactions,
    user?.safeAddress,
  );

  const topThreeTokens = uniqueTokens.slice(0, 3);
  const isDeposited = !!userDepositTransactions?.deposits?.length;

  const cardBalance = Number(cardDetails?.balances.available?.amount || '0');

  useEffect(() => {
    const interval = setInterval(() => {
      refetchBalance();
      refetchTransactions();
    }, 60000); // 60 seconds
    return () => clearInterval(interval);
  }, [refetchBalance, refetchTransactions]);

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
    return <SavingsEmptyState />;
  }

  return (
    <PageLayout isLoading={isBalanceLoading}>
      <View className="mx-auto mb-5 w-full max-w-7xl gap-8 px-0 py-0 pb-20 md:gap-12 md:px-4 md:py-12">
        {isScreenMedium ? (
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="flex-row items-center">
                {isLoadingTokens ||
                isBalanceLoading ||
                isAPYsLoading ||
                firstDepositTimestamp === undefined ||
                savings === undefined ? (
                  <Skeleton className="h-[4.5rem] w-56 rounded-xl" />
                ) : (
                  <CountUp
                    prefix="$"
                    count={totalUSDExcludingSoUSD + savings + cardBalance}
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
            <DashboardHeaderButtons />
          </View>
        ) : (
          <DashboardHeaderMobile
            balance={totalUSDExcludingSoUSD + (savings ?? 0) + cardBalance}
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
            balance={balance}
            isBalanceLoading={isBalanceLoading}
            firstDepositTimestamp={firstDepositTimestamp}
            userDepositTransactions={userDepositTransactions}
          />
        ) : (
          <MobileCards
            totalUSDExcludingSoUSD={totalUSDExcludingSoUSD}
            topThreeTokens={topThreeTokens}
            isLoadingTokens={isLoadingTokens}
            userHasCard={userHasCard}
            cardBalance={cardBalance}
            balance={balance}
            isBalanceLoading={isBalanceLoading}
            firstDepositTimestamp={firstDepositTimestamp}
            userDepositTransactions={userDepositTransactions}
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
            <WalletInfo text="Loading tokens..." />
          ) : hasTokens ? (
            <WalletTabs />
          ) : (
            <WalletInfo text="No tokens found" />
          )}
        </View>

        <View className="gap-6 px-4 md:mt-10 md:px-0">
          <Text className="text-lg font-semibold text-muted-foreground">Promotions</Text>
          <HomeBanners />
        </View>
      </View>
    </PageLayout>
  );
}
