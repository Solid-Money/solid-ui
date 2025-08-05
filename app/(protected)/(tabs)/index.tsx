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
import { cn } from '@/lib/utils';
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

  const { data: totalAPY, isLoading: isTotalAPYLoading } = useTotalAPY();
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

  const {
    data: sendTransactions,
    isLoading: isSendTransactionsLoading,
    refetch: refetchSendTransactions,
  } = useSendTransactions(user?.safeAddress ?? '');

  const {
    data: transactions,
    isLoading: isFormattingTransactions,
    refetch: refetchFormattedTransactions,
  } = useQuery({
    queryKey: ['formatted-transactions', userDepositTransactions],
    queryFn: () => formatTransactions(userDepositTransactions, sendTransactions),
    enabled: !!userDepositTransactions,
  });

  const { originalDepositAmount, firstDepositTimestamp } = useDepositCalculations(
    userDepositTransactions,
    balance,
    lastTimestamp,
  );

  const getTransactionClassName = (totalTransactions: number, index: number) => {
    const classNames = [];
    if (index === 0) classNames.push('rounded-t-twice');
    if (index === totalTransactions - 1) classNames.push('rounded-b-twice border-0');
    return cn(...classNames);
  };

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

  const transactionData = {
    transactions: transactions ?? [],
    getTransactionClassName,
  };

  const loadingStates = {
    balance: isBalanceLoading,
    totalAPY: isTotalAPYLoading,
    transactions: isTransactionsLoading || isFormattingTransactions || isSendTransactionsLoading,
  };

  return Platform.OS === 'web' ? (
    <DashboardWeb
      balanceData={balanceData}
      transactionData={transactionData}
      isLoading={loadingStates}
    />
  ) : (
    <DashboardMobile balanceData={balanceData} />
  );
}
