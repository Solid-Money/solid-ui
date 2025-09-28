import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { RefreshControl, View } from 'react-native';
import { mainnet } from 'viem/chains';
import { useBlockNumber } from 'wagmi';

import { useActivity } from '@/hooks/useActivity';

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
import { createActivityEvent, fetchActivityEvents } from '@/lib/api';
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
  const { storeEvents } = useActivityStore();
  const { activities, pendingCount, refreshActivities } = useActivity();

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
    refetch: refetchActivityEvents,
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

  let fetchedEvents = useMemo(
    () => activityData?.pages.flatMap(page => page?.docs || []) || [],
    [activityData],
  );

  // Sync external transactions to database if they don't exist
  useEffect(() => {
    if (!user?.userId || !transactions || transactions.length === 0) return;

    const syncTransactions = async () => {
      await Promise.all(
        transactions.map(async tx => {
          // Check if this transaction already exists in our activities
          const existsInActivities = activities.some(
            activity =>
              activity.hash === tx.hash ||
              activity.clientTxId === `${tx.type}-${tx.hash}` ||
              (tx.hash && activity.hash === tx.hash),
          );

          const existsInServer = fetchedEvents.some(
            activity =>
              activity.hash === tx.hash ||
              activity.clientTxId === `${tx.type}-${tx.hash}` ||
              (tx.hash && activity.hash === tx.hash),
          );

          // If transaction doesn't exist in either local or server, sync it
          if (!existsInActivities && !existsInServer && tx.hash) {
            try {
              // Create activity for external transaction
              await withRefreshToken(() =>
                createActivityEvent({
                  clientTxId: `${tx.type}-${tx.hash}`,
                  title: tx.title || `${tx.type} Transaction`,
                  timestamp: tx.timestamp,
                  type: tx.type,
                  status: tx.status,
                  amount: tx.amount.toString(),
                  symbol: tx.symbol || 'USDC',
                  chainId: tx.chainId,
                  fromAddress: tx.fromAddress || user.safeAddress,
                  toAddress: tx.toAddress,
                  hash: tx.hash,
                  url: tx.url,
                  metadata: {
                    description: tx.title || `External ${tx.type} transaction`,
                    source: 'external-sync',
                    originalType: tx.type,
                    synced: true,
                  },
                }),
              );
            } catch (error) {
              console.error(`Failed to sync external transaction ${tx.hash}:`, error);
            }
          }
        }),
      );
    };

    syncTransactions();
  }, [transactions, activities, fetchedEvents, user?.userId, user?.safeAddress]);

  // Sync local store with confirmed server activities
  useEffect(() => {
    if (!user?.userId || !fetchedEvents || fetchedEvents.length === 0) return;

    const serverActivities = fetchedEvents;
    const localActivities = activities;

    // Find local activities that are now confirmed on server and update them
    localActivities.forEach(localActivity => {
      const serverVersion = serverActivities.find(serverAct => {
        const matches =
          serverAct.clientTxId === localActivity.clientTxId ||
          serverAct.userOpHash === localActivity.userOpHash ||
          serverAct.hash === localActivity.hash ||
          (serverAct.userOpHash && serverAct.userOpHash === localActivity.clientTxId) ||
          (serverAct.hash && serverAct.hash === localActivity.hash);

        return matches;
      });

      // If found on server with confirmed status, update local
      if (
        serverVersion &&
        (serverVersion.status === TransactionStatus.SUCCESS ||
          serverVersion.status === TransactionStatus.FAILED) &&
        localActivity.status !== serverVersion.status
      ) {
        storeEvents(user.userId, [serverVersion]);
      }
    });
  }, [fetchedEvents, activities, user?.userId, storeEvents]);

  // Merge local activities (for immediate feedback) with server activities
  const allEvents = useMemo(() => {
    const serverEvents = fetchedEvents;
    const localEvents = activities;

    // Combine server first (source of truth for confirmed), then local (for pending)
    const combined = [...serverEvents, ...localEvents];

    // Deduplicate by multiple identifiers, preferring confirmed server activities
    const activityMap = new Map<string, ActivityEvent>();

    combined.forEach(activity => {
      const keys: string[] = [];
      if (activity.clientTxId) keys.push(`client:${activity.clientTxId}`);
      if (activity.userOpHash) keys.push(`userOp:${activity.userOpHash}`);
      if (activity.hash) keys.push(`hash:${activity.hash}`);

      if (keys.length === 0) {
        keys.push(`fallback:${activity.type}-${activity.timestamp}`);
      }

      // Check if any key exists
      let existingActivity: ActivityEvent | undefined;
      for (const key of keys) {
        if (activityMap.has(key)) {
          existingActivity = activityMap.get(key);
          break;
        }
      }

      if (!existingActivity) {
        // New activity - add all keys
        keys.forEach(key => activityMap.set(key, activity));
      } else {
        // Existing found - prefer confirmed status
        const shouldReplace =
          activity.status === TransactionStatus.SUCCESS ||
          activity.status === TransactionStatus.FAILED;

        if (shouldReplace) {
          // Remove old keys
          activityMap.forEach((value, mapKey) => {
            if (value === existingActivity) {
              activityMap.delete(mapKey);
            }
          });
          // Add new with all keys
          keys.forEach(key => activityMap.set(key, activity));
        }
      }
    });

    const uniqueActivities = new Set<ActivityEvent>();
    activityMap.forEach(activity => uniqueActivities.add(activity));

    return Array.from(uniqueActivities).sort(
      (a, b) => parseInt(b.timestamp) - parseInt(a.timestamp),
    );
  }, [fetchedEvents, activities]);

  fetchedEvents = allEvents;

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

  // Auto-refresh for pending transactions
  useEffect(() => {
    if (pendingCount === 0) return;

    const interval = setInterval(() => {
      refreshActivities();
      refetchActivityEvents();
      refetchTransactions();
      refetchFormattedTransactions();
    }, 3000); // Refresh every 3 seconds when there are pending transactions

    return () => clearInterval(interval);
  }, [
    pendingCount,
    refreshActivities,
    refetchActivityEvents,
    refetchTransactions,
    refetchFormattedTransactions,
  ]);

  const renderStatusHeader = () => {
    if (pendingCount === 0) return null;

    return (
      <View className="mb-4 p-4 md:px-6 bg-card rounded-xl border border-border/40">
        <View className="flex-row items-center gap-3">
          <View className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          <Text className="text-foreground font-medium text-sm flex-1">
            {pendingCount} transaction{pendingCount > 1 ? 's' : ''} pending
          </Text>
          <View className="bg-yellow-400/10 px-2 py-1 rounded-md">
            <Text className="text-yellow-400 text-xs font-medium">Processing</Text>
          </View>
        </View>
        <Text className="text-muted-foreground text-xs mt-2 ml-5">
          Updates automatically every few seconds
        </Text>
      </View>
    );
  };

  const renderEmpty = () => (
    <View className="py-16 px-4">
      <Text className="text-muted-foreground text-center text-lg">
        {tab === ActivityTab.PROGRESS ? 'No pending transactions' : 'No transactions found'}
      </Text>
      {tab === ActivityTab.ALL && (
        <Text className="text-muted-foreground text-center text-sm mt-2">
          Start by making a swap or sending tokens
        </Text>
      )}
    </View>
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
    <View className="flex-1">
      {renderStatusHeader()}
      <FlashList
        data={filteredTransactions}
        renderItem={renderItem}
        keyExtractor={(item, index) => item.clientTxId || `${item.timestamp}-${index}`}
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
        contentContainerStyle={{ paddingVertical: 0, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              refreshActivities();
              refetchTransactions();
              refetchFormattedTransactions();
              refetchSendTransactions();
              refetchBridgeDepositTransactions();
              refetchBankTransfers();
            }}
            tintColor="#666"
            colors={['#666']}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
