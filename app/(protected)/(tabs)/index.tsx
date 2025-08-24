import { DashboardHeaderMobile } from '@/components/Dashboard';
import DashboardHeaderButtons from '@/components/Dashboard/DashboardHeaderButtons';
import { HomeBanners } from '@/components/Dashboard/HomeBanners';
import Loading from '@/components/Loading';
import Navbar from '@/components/Navbar';
import NavbarMobile from '@/components/Navbar/NavbarMobile';
import SavingsEmptyState from '@/components/Savings/EmptyState';
import TooltipPopover from '@/components/Tooltip';
import { Text } from '@/components/ui/text';
import { SavingCard, WalletCard, WalletInfo } from '@/components/Wallet';
import WalletTabs from '@/components/Wallet/WalletTabs';
import { useGetUserTransactionsQuery } from '@/graphql/generated/user-info';
import { useLatestTokenTransfer, useTotalAPY } from '@/hooks/useAnalytics';
import { useDepositCalculations } from '@/hooks/useDepositCalculations';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { useFuseVaultBalance } from '@/hooks/useVault';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { ADDRESSES } from '@/lib/config';
import { calculateYield } from '@/lib/financial';
import { SavingMode } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';
import React, { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  } = useFuseVaultBalance(user?.safeAddress as Address);
  const { updateUser } = useUserStore();

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: mainnet.id,
  });

  const { data: totalAPY } = useTotalAPY();
  const { isLoading: isLoadingTokens, hasTokens, soUSDEthereum, uniqueTokens } = useWalletTokens();
  const { data: lastTimestamp } = useLatestTokenTransfer(
    user?.safeAddress ?? '',
    ADDRESSES.fuse.vault,
  );

  const {
    data: userDepositTransactions,
    loading: isTransactionsLoading,
    refetch: refetchTransactions,
  } = useGetUserTransactionsQuery({
    variables: {
      address: user?.safeAddress?.toLowerCase() ?? '',
    },
  });

  const { originalDepositAmount, firstDepositTimestamp } = useDepositCalculations(
    userDepositTransactions,
    balance,
    lastTimestamp,
  );

  const savings = calculateYield(
    balance ?? 0,
    totalAPY ?? 0,
    firstDepositTimestamp ?? 0,
    Math.floor(Date.now() / 1000),
    originalDepositAmount,
  );

  const topThreeTokens = uniqueTokens.slice(0, 3);
  const isDeposited = !!userDepositTransactions?.deposits?.length;

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

  if (isBalanceLoading || isTransactionsLoading) {
    return <Loading />;
  }

  if (!balance && !isDeposited) {
    return <SavingsEmptyState />;
  }

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        {!isScreenMedium && <NavbarMobile />}
        {isScreenMedium && <Navbar />}
        <View className="gap-8 md:gap-16 px-4 py-8 md:py-12 w-full max-w-7xl mx-auto">
          {isScreenMedium ? (
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center gap-2">
                <Text className="text-5xl font-semibold">
                  ${formatNumber(soUSDEthereum + savings)}
                </Text>
                <TooltipPopover text="Total = Wallet + Savings" />
              </View>
              <DashboardHeaderButtons hasTokens={hasTokens} />
            </View>
          ) : (
            <DashboardHeaderMobile
              balance={soUSDEthereum + savings}
              mode={SavingMode.BALANCE_ONLY}
            />
          )}
          {isScreenMedium ? (
            <View className="md:flex-row gap-4 min-h-44">
              <WalletCard balance={soUSDEthereum} className="flex-1" tokens={topThreeTokens} />
              <SavingCard savings={savings} className="flex-1" />
            </View>
          ) : (
            <HomeBanners />
          )}

          <View className="gap-4">
            <Text className="md:text-2xl text-muted-foreground md:text-foreground font-semibold md:font-medium">
              Coins
            </Text>
            <View>
              {isLoadingTokens ? (
                <WalletInfo text="Loading tokens..." />
              ) : hasTokens ? (
                <WalletTabs />
              ) : (
                <WalletInfo text="No tokens found" />
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
