import CountUp from '@/components/CountUp';
import { DashboardHeaderMobile } from '@/components/Dashboard';
import DashboardHeaderButtons from '@/components/Dashboard/DashboardHeaderButtons';
import { HomeBanners } from '@/components/Dashboard/HomeBanners';
import PageLayout from '@/components/PageLayout';
import SavingsEmptyState from '@/components/Savings/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Card, SavingCard, WalletCard, WalletInfo } from '@/components/Wallet';
import WalletTabs from '@/components/Wallet/WalletTabs';
import { USDC_TOKEN_BALANCE } from '@/constants/tokens';
import { useGetUserTransactionsQuery } from '@/graphql/generated/user-info';
import { useAPYs, useLatestTokenTransfer } from '@/hooks/useAnalytics';
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
import React, { useEffect } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Address } from 'viem';
import { mainnet } from 'viem/chains';
import { useBlockNumber } from 'wagmi';

export default function Savings() {
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

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: mainnet.id,
  });

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
    loading: isTransactionsLoading,
    refetch: refetchTransactions,
  } = useGetUserTransactionsQuery({
    variables: {
      address: user?.safeAddress?.toLowerCase() ?? '',
    },
  });

  const { firstDepositTimestamp } = useDepositCalculations(
    userDepositTransactions,
    balance,
    lastTimestamp,
  );

  const { savings } = useCalculateSavings(
    balance ?? 0,
    apys?.allTime ?? 0,
    firstDepositTimestamp ?? 0,
    Math.floor(Date.now() / 1000),
    SavingMode.TOTAL_USD,
    userDepositTransactions,
    user?.safeAddress,
  );

  const topThreeTokens = uniqueTokens.slice(0, 3);
  const isDeposited = !!userDepositTransactions?.deposits?.length;

  const cardBalance = Number(cardDetails?.balances.available?.amount || '0');

  useEffect(() => {
    refetchBalance();
    refetchTransactions();
  }, [blockNumber, refetchBalance, refetchTransactions]);

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
    <PageLayout isLoading={isBalanceLoading || isTransactionsLoading}>
      <View className="gap-8 md:gap-12 px-0 md:px-4 py-0 md:py-12 w-full max-w-7xl mx-auto pb-20 mb-5">
        {isScreenMedium ? (
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center gap-2">
              <View className="flex-row items-center">
                {isLoadingTokens ||
                isBalanceLoading ||
                isAPYsLoading ||
                firstDepositTimestamp === undefined ||
                savings === undefined ? (
                  <Skeleton className="w-56 h-[4.5rem] rounded-xl" />
                ) : (
                  <CountUp
                    prefix="$"
                    count={totalUSDExcludingSoUSD + savings + cardBalance}
                    isTrailingZero={false}
                    decimalPlaces={2}
                    classNames={{
                      wrapper: 'text-foreground',
                      decimalSeparator: 'text-5xl font-semibold',
                    }}
                    styles={{
                      wholeText: {
                        fontSize: fontSize(3),
                        fontWeight: '500',
                        //fontFamily: 'MonaSans_600SemiBold',
                        color: '#ffffff',
                        marginRight: -1,
                      },
                      decimalText: {
                        fontSize: fontSize(3),
                        fontWeight: '500',
                        //fontFamily: 'MonaSans_600SemiBold',
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
          <View className="md:flex-row gap-6 min-h-44">
            <WalletCard
              balance={totalUSDExcludingSoUSD}
              className="flex-1"
              tokens={topThreeTokens}
              isLoading={isLoadingTokens}
              decimalPlaces={2}
            />
            {!userHasCard && (
              <Card
                balance={cardBalance}
                className="flex-1"
                tokens={[USDC_TOKEN_BALANCE]}
                isLoading={isLoadingTokens}
                decimalPlaces={2}
              />
            )}
            <SavingCard className="flex-1" decimalPlaces={2} />
          </View>
        ) : (
          <HomeBanners />
        )}

        <View className="px-4 md:px-0 mt-4 gap-3">
          <Text className="text-lg text-muted-foreground font-semibold">Your assets</Text>
          {tokenError ? (
            <View className="flex-1 justify-center items-center p-4">
              <WalletInfo text="Failed to load tokens" />
              <Text className="text-sm text-muted-foreground mt-2">{tokenError}</Text>
              <TouchableOpacity
                onPress={retryTokens}
                className="mt-4 px-4 py-2 bg-primary rounded-lg"
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

        <View className="hidden md:flex px-4 md:px-0 mt-10 gap-6">
          <Text className="text-lg text-muted-foreground font-semibold">Promotions</Text>
          <HomeBanners />
        </View>
      </View>
    </PageLayout>
  );
}
