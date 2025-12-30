import React, { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Address } from 'viem';
import { mainnet } from 'viem/chains';
import { useBlockNumber } from 'wagmi';

import Navbar from '@/components/Navbar';
import { useGetUserTransactionsQuery } from '@/graphql/generated/user-info';
import { useLatestTokenTransfer, useTotalAPY } from '@/hooks/useAnalytics';
import { useDepositCalculations } from '@/hooks/useDepositCalculations';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { ADDRESSES } from '@/lib/config';
import { DashboardCards } from './DashboardCards';
import { DashboardCardsNoFunds } from './DashboardCardsNoFunds';
import DashboardHeader from './DashboardHeader';
import { DashboardTokens } from './DashboardTokens';

export function DashboardWeb() {
  const { user } = useUser();

  const { data: blockNumber } = useBlockNumber({ watch: true, chainId: mainnet.id });
  const {
    totalUSD,
    tokens,
    isLoading: isTokensLoading,
    hasTokens,
    error: tokenError,
    retry: retryTokens,
    isRefreshing,
  } = useWalletTokens();
  const { data: balance, refetch: refetchBalance } = useVaultBalance(user?.safeAddress as Address);

  const { data: totalAPY } = useTotalAPY();
  const { data: lastTimestamp } = useLatestTokenTransfer(
    user?.safeAddress ?? '',
    ADDRESSES.fuse.vault,
  );
  const { data: userDepositTransactions, refetch: refetchTransactions } =
    useGetUserTransactionsQuery({
      variables: {
        address: user?.safeAddress?.toLowerCase() ?? '',
      },
    });
  const { firstDepositTimestamp } = useDepositCalculations(
    userDepositTransactions,
    balance,
    lastTimestamp,
  );

  useEffect(() => {
    refetchBalance();
    refetchTransactions();
  }, [blockNumber, refetchBalance, refetchTransactions]);

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        <Navbar />
        <View className="gap-8 md:gap-16 px-4 pt-4 pb-8 w-full max-w-7xl mx-auto">
          <DashboardHeader
            balance={balance ?? 0}
            totalAPY={totalAPY ?? 0}
            firstDepositTimestamp={firstDepositTimestamp ?? 0}
            hasTokens={hasTokens}
          />

          {hasTokens ? (
            <DashboardCards totalUSD={totalUSD} tokens={tokens} />
          ) : (
            <DashboardCardsNoFunds />
          )}
          {(hasTokens || tokenError) && (
            <DashboardTokens
              isTokensLoading={isTokensLoading}
              hasTokens={hasTokens}
              error={tokenError}
              onRetry={retryTokens}
              isRefreshing={isRefreshing}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
