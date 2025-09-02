import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { View } from 'react-native';
import { mainnet } from 'viem/chains';
import { useBlockNumber } from 'wagmi';

import Transaction from '@/components/Transaction';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useGetUserTransactionsQuery } from '@/graphql/generated/user-info';
import {
  formatTransactions,
  useBridgeDepositTransactions,
  useSendTransactions,
} from '@/hooks/useAnalytics';
import useUser from '@/hooks/useUser';
import { ActivityTab, LayerZeroTransactionStatus } from '@/lib/types';

type ActivityTransactionsProps = {
  tab?: ActivityTab;
};

export default function ActivityTransactions({ tab = ActivityTab.ALL }: ActivityTransactionsProps) {
  const { user } = useUser();

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: mainnet.id,
  });

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
    data: bridgeDepositTransactions,
    isLoading: isBridgeDepositTransactionsLoading,
    refetch: refetchBridgeDepositTransactions,
  } = useBridgeDepositTransactions(user?.safeAddress ?? '');

  const {
    data: transactions,
    isLoading: isFormattingTransactions,
    refetch: refetchFormattedTransactions,
  } = useQuery({
    queryKey: [
      'formatted-transactions',
      user?.safeAddress,
      userDepositTransactions?.deposits?.length,
      sendTransactions?.fuse?.length,
      sendTransactions?.ethereum?.length,
      bridgeDepositTransactions?.length,
    ],
    queryFn: () =>
      formatTransactions(userDepositTransactions, sendTransactions, bridgeDepositTransactions),
  });

  const isLoading =
    isTransactionsLoading ||
    isFormattingTransactions ||
    isSendTransactionsLoading ||
    isBridgeDepositTransactionsLoading;

  const getTransactionClassName = (totalTransactions: number, index: number) => {
    // Remove bottom border for last item only
    if (index === totalTransactions - 1) return 'border-b-0';
    return '';
  };

  useEffect(() => {
    refetchTransactions();
    refetchFormattedTransactions();
    refetchSendTransactions();
    refetchBridgeDepositTransactions();
  }, [
    blockNumber,
    refetchTransactions,
    refetchFormattedTransactions,
    refetchSendTransactions,
    refetchBridgeDepositTransactions,
  ]);

  const filteredTransactions = transactions?.filter(transaction => {
    if (tab === ActivityTab.ALL) return true;
    if (tab === ActivityTab.PROGRESS)
      return transaction.status === LayerZeroTransactionStatus.INFLIGHT;
    return false;
  });

  return (
    <View>
      {isLoading ? (
        <Skeleton className="w-full h-16 bg-card rounded-xl md:rounded-twice" />
      ) : filteredTransactions?.length ? (
        <View className="bg-card rounded-xl md:rounded-twice overflow-hidden">
          {filteredTransactions.map((transaction, index) => (
            <Transaction
              key={`${transaction.timestamp}-${index}`}
              {...transaction}
              classNames={{
                container: getTransactionClassName(filteredTransactions.length, index),
              }}
            />
          ))}
        </View>
      ) : (
        <Text className="text-muted-foreground">No transactions found</Text>
      )}
    </View>
  );
}
