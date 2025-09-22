import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { View } from 'react-native';
import { mainnet } from 'viem/chains';
import { useBlockNumber } from 'wagmi';

import Transaction from '@/components/Transaction';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useGetUserTransactionsQuery } from '@/graphql/generated/user-info';
import {
  formatTransactions,
  useBankTransferTransactions,
  useBridgeDepositTransactions,
  useSendTransactions,
} from '@/hooks/useAnalytics';
import useUser from '@/hooks/useUser';
import { fetchActivityEvents } from '@/lib/api';
import { ActivityEvent, ActivityTab, TransactionStatus, TransactionType } from '@/lib/types';
import { cn, withRefreshToken } from '@/lib/utils';
import { useActivityStore } from '@/store/useActivityStore';
import { useDepositStore } from '@/store/useDepositStore';

type ActivityTransactionsProps = {
  tab?: ActivityTab;
};

export default function ActivityTransactions({ tab = ActivityTab.ALL }: ActivityTransactionsProps) {
  const { user } = useUser();
  const { setModal, setBankTransferData } = useDepositStore();
  const { events, storeEvents } = useActivityStore();

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: mainnet.id,
  });

  const {
    data: activityData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['activity-events', user?.userId],
    queryFn: ({ pageParam = 1 }) => withRefreshToken(() => fetchActivityEvents(pageParam)),
    getNextPageParam: lastPage => {
      if (!lastPage) return undefined;
      if (lastPage.hasNextPage) {
        return lastPage.page + 1;
      }
    },
    initialPageParam: 1,
  });

  const { data: userDepositTransactions, refetch: refetchTransactions } =
    useGetUserTransactionsQuery({
      variables: {
        address: user?.safeAddress?.toLowerCase() ?? '',
      },
    });

  const { data: sendTransactions, refetch: refetchSendTransactions } = useSendTransactions(
    user?.safeAddress ?? '',
  );

  const { data: bridgeDepositTransactions, refetch: refetchBridgeDepositTransactions } =
    useBridgeDepositTransactions(user?.safeAddress ?? '');

  const { data: bankTransferTransactions, refetch: refetchBankTransfers } =
    useBankTransferTransactions();

  const { data: transactions, refetch: refetchFormattedTransactions } = useQuery({
    queryKey: [
      'formatted-transactions',
      user?.safeAddress,
      userDepositTransactions?.deposits?.length,
      sendTransactions?.fuse?.length,
      sendTransactions?.ethereum?.length,
      bridgeDepositTransactions?.length,
      bankTransferTransactions?.length,
    ],
    queryFn: () =>
      formatTransactions(
        userDepositTransactions,
        sendTransactions,
        bridgeDepositTransactions,
        bankTransferTransactions,
      ),
  });

  const getTransactionClassName = (totalTransactions: number, index: number) => {
    const classNames = ['bg-card overflow-hidden'];
    if (index === 0) classNames.push('rounded-t-xl md:rounded-t-twice');
    if (index === totalTransactions - 1)
      classNames.push('border-b-0 rounded-b-xl md:rounded-b-twice');
    return cn(classNames);
  };

  useEffect(() => {
    refetchTransactions();
    refetchFormattedTransactions();
    refetchSendTransactions();
    refetchBridgeDepositTransactions();
    refetchBankTransfers();
  }, [
    blockNumber,
    refetchTransactions,
    refetchFormattedTransactions,
    refetchSendTransactions,
    refetchBridgeDepositTransactions,
    refetchBankTransfers,
  ]);

  useEffect(() => {
    if (!transactions || !user?.userId) return;
    storeEvents(
      user.userId,
      transactions.map(transaction => ({
        ...transaction,
        clientTxId: `${transaction.type}-${transaction.hash}`,
        amount: transaction.amount.toString(),
        timestamp: parseInt(transaction.timestamp).toString(),
      })),
    );
  }, [transactions, user?.userId, storeEvents]);

  let fetchedEvents = activityData?.pages.flatMap(page => page?.docs || []) || [];
  if (!fetchedEvents.length && user?.userId && events[user.userId]) {
    fetchedEvents = events[user?.userId];
  }
  fetchedEvents = [...fetchedEvents].sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));

  const filteredTransactions = fetchedEvents.filter(transaction => {
    if (tab === ActivityTab.ALL) return true;
    if (tab === ActivityTab.PROGRESS) {
      return transaction.status === TransactionStatus.PENDING;
    }
    return false;
  });

  const renderItem = ({ item, index }: { item: ActivityEvent; index: number }) => (
    <Transaction
      key={`${item.timestamp}-${index}`}
      {...item}
      onPress={() => {
        if (item.type === TransactionType.BANK_TRANSFER) {
          setBankTransferData({
            instructions: item.sourceDepositInstructions,
            fromActivity: true,
          });
          setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_PREVIEW);
        }
      }}
      classNames={{
        container: getTransactionClassName(filteredTransactions.length, index),
      }}
    />
  );

  const renderLoading = () => (
    <Skeleton className="w-full h-16 bg-card rounded-xl md:rounded-twice" />
  );

  const renderEmpty = () => (
    <Text className="text-muted-foreground text-center py-8">No transactions found</Text>
  );

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return renderLoading();
    }
    return null;
  };

  if (isLoading && !filteredTransactions.length) {
    return renderLoading();
  }

  return (
    <FlashList
      data={filteredTransactions}
      renderItem={renderItem}
      keyExtractor={(item, index) => `${item.timestamp}-${index}`}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      estimatedItemSize={80}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={renderFooter}
      ItemSeparatorComponent={() => <View className="h-0" />}
      contentContainerStyle={{ paddingVertical: 0 }}
    />
  );
}
