import { DashboardMobile } from '@/components/Dashboard/DashboardMobile';
import { DashboardWeb } from '@/components/Dashboard/DashboardWeb';
import Loading from '@/components/Loading';
import { useGetUserTransactionsQuery } from '@/graphql/generated/user-info';
import {
  formatTransactions,
  useLatestTokenTransfer,
  useSendTransactions,
  useTotalAPY,
} from '@/hooks/useAnalytics';
import { useDepositCalculations } from '@/hooks/useDepositCalculations';
import useUser from '@/hooks/useUser';
import { useFuseVaultBalance } from '@/hooks/useVault';
import { ADDRESSES } from '@/lib/config';
import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Address } from 'viem';
import { mainnet } from 'viem/chains';
import { useBlockNumber } from 'wagmi';

export default function Dashboard() {
  const { user } = useUser();

  const {
    data: balance,
    isLoading: isBalanceLoading,
    refetch: refetchBalance,
  } = useFuseVaultBalance(user?.safeAddress as Address);
  const [_balanceLoadingCount, setBalanceLoadingCount] = useState(0);

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: mainnet.id,
  });

  const { data: totalAPY } = useTotalAPY();
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

  const { data: sendTransactions, refetch: refetchSendTransactions } = useSendTransactions(
    user?.safeAddress ?? '',
  );

  const { refetch: refetchFormattedTransactions } = useQuery({
    queryKey: ['formatted-transactions', userDepositTransactions],
    queryFn: () => formatTransactions(userDepositTransactions, sendTransactions),
    enabled: !!userDepositTransactions,
  });

  const { originalDepositAmount, firstDepositTimestamp } = useDepositCalculations(
    userDepositTransactions,
    balance,
    lastTimestamp,
  );

  useEffect(() => {
    refetchBalance();
    refetchTransactions();
    refetchFormattedTransactions();
    refetchSendTransactions();
  }, [
    blockNumber,
    refetchBalance,
    refetchTransactions,
    refetchFormattedTransactions,
    refetchSendTransactions,
  ]);

  useEffect(() => {
    if (isBalanceLoading) {
      setBalanceLoadingCount(prev => prev + 1);
    }
  }, [isBalanceLoading]);

  if (isBalanceLoading || isTransactionsLoading) {
    return <Loading />;
  }

  const balanceData = {
    balance: balance ?? 0,
    totalAPY: totalAPY ?? 0,
    firstDepositTimestamp: firstDepositTimestamp ?? 0,
    originalDepositAmount,
  };

  return Platform.OS === 'web' ? <DashboardWeb /> : <DashboardMobile balanceData={balanceData} />;
}
