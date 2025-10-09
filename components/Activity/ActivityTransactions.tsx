import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { isBefore, subDays } from 'date-fns';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { mainnet } from 'viem/chains';
import { useBlockNumber } from 'wagmi';

import TimeGroupHeader from '@/components/Activity/TimeGroupHeader';
import Transaction from '@/components/Transaction';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useGetUserTransactionsQuery } from '@/graphql/generated/user-info';
import { useActivity } from '@/hooks/useActivity';
import {
  formatTransactions,
  useBankTransferTransactions,
  useBridgeDepositTransactions,
  useSendTransactions,
} from '@/hooks/useAnalytics';
import { useCardDepositPoller } from '@/hooks/useCardDepositPoller';
import useUser from '@/hooks/useUser';
import { createActivityEvent, fetchActivityEvents } from '@/lib/api';
import {
  ActivityEvent,
  ActivityGroup,
  ActivityTab,
  TransactionStatus,
  TransactionType,
} from '@/lib/types';
import { cn, withRefreshToken } from '@/lib/utils';
import { groupTransactionsByTime, TimeGroup, TimeGroupHeaderData } from '@/lib/utils/timeGrouping';
import { useActivityStore } from '@/store/useActivityStore';
import { useDepositStore } from '@/store/useDepositStore';

type ActivityTransactionsProps = {
  tab?: ActivityTab;
};

type RenderItemProps = {
  item: TimeGroup;
  index: number;
};

export default function ActivityTransactions({ tab = ActivityTab.ALL }: ActivityTransactionsProps) {
  const { user } = useUser();
  const { setModal, setBankTransferData } = useDepositStore();
  const { storeEvents } = useActivityStore();
  const { activities, pendingCount, refreshActivities } = useActivity();
  const [showStuckTransactions, setShowStuckTransactions] = useState(false);

  // Poll Bridge API to update card deposit status when processed
  useCardDepositPoller();

  const isTransactionStuck = (timestamp: string): boolean => {
    const transactionDate = new Date(parseInt(timestamp) * 1000);
    const oneDayAgo = subDays(new Date(), 1);
    return isBefore(transactionDate, oneDayAgo);
  };

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

  const getTransactionClassName = (groupedData: TimeGroup[], currentIndex: number) => {
    const classNames = ['bg-card overflow-hidden'];

    // Find the current group's transactions
    const currentGroupTransactions = [];
    let currentGroupStart = -1;
    let currentGroupEnd = -1;

    // Find the start of current group
    for (let i = currentIndex; i >= 0; i--) {
      if (groupedData[i].type === ActivityGroup.HEADER) {
        currentGroupStart = i + 1;
        break;
      }
    }

    // Find the end of current group
    for (let i = currentIndex; i < groupedData.length; i++) {
      if (groupedData[i].type === ActivityGroup.HEADER && i > currentIndex) {
        currentGroupEnd = i - 1;
        break;
      }
    }

    // If we're at the end of the list, the group ends there
    if (currentGroupEnd === -1) {
      currentGroupEnd = groupedData.length - 1;
    }

    // Get all transactions in current group that would actually be rendered
    for (let i = currentGroupStart; i <= currentGroupEnd; i++) {
      if (groupedData[i].type === ActivityGroup.TRANSACTION) {
        const transaction = groupedData[i].data as ActivityEvent;
        const isPending = transaction.status === TransactionStatus.PENDING;
        const isStuck = isTransactionStuck(transaction.timestamp);

        // Only include transactions that would be rendered (not filtered out)
        if (showStuckTransactions || !(isPending && isStuck)) {
          currentGroupTransactions.push(i);
        }
      }
    }

    // Find position within the group
    const groupTransactionIndex = currentGroupTransactions.indexOf(currentIndex);
    const isFirstInGroup = groupTransactionIndex === 0;
    const isLastInGroup = groupTransactionIndex === currentGroupTransactions.length - 1;

    if (isFirstInGroup) classNames.push('rounded-t-twice');
    if (isLastInGroup) classNames.push('border-b-0 rounded-b-twice');

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

  // Track previous values to prevent infinite loops
  const prevFetchedEventsRef = useRef<ActivityEvent[]>([]);
  const prevActivitiesRef = useRef<ActivityEvent[]>([]);

  // Sync local store with confirmed server activities
  useEffect(() => {
    if (!user?.userId || !fetchedEvents || fetchedEvents.length === 0) return;

    const serverActivities = fetchedEvents;
    const localActivities = activities;

    const fetchedEventsChanged =
      prevFetchedEventsRef.current.length !== serverActivities.length ||
      prevFetchedEventsRef.current.some(
        (prev, index) =>
          !serverActivities[index] || prev.clientTxId !== serverActivities[index].clientTxId,
      );

    const activitiesChanged =
      prevActivitiesRef.current.length !== localActivities.length ||
      prevActivitiesRef.current.some(
        (prev, index) =>
          !localActivities[index] || prev.clientTxId !== localActivities[index].clientTxId,
      );

    if (!fetchedEventsChanged && !activitiesChanged) return;

    prevFetchedEventsRef.current = [...serverActivities];
    prevActivitiesRef.current = [...localActivities];

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

    if (!localActivities.length && serverActivities.length) {
      storeEvents(user.userId, serverActivities);
    }
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

  const filteredTransactions = useMemo(() => {
    const filtered = fetchedEvents.filter(transaction => {
      if (tab === ActivityTab.ALL) return true;
      if (tab === ActivityTab.PROGRESS) {
        return transaction.status === TransactionStatus.PENDING;
      }
      return false;
    });

    return groupTransactionsByTime(filtered);
  }, [fetchedEvents, tab]);

  const renderItem = ({ item, index }: RenderItemProps) => {
    if (item.type === ActivityGroup.HEADER) {
      return (
        <TimeGroupHeader
          index={index}
          title={item.data.title}
          isPending={item.data.status === TransactionStatus.PENDING}
          showStuck={showStuckTransactions}
          onToggleStuck={setShowStuckTransactions}
        />
      );
    }

    const transaction = item.data as ActivityEvent;
    const isPending = transaction.status === TransactionStatus.PENDING;
    const isStuck = isTransactionStuck(transaction.timestamp);
    if (!showStuckTransactions && isPending && isStuck) {
      return null;
    }

    return (
      <Transaction
        key={`${transaction.timestamp}-${index}`}
        {...transaction}
        onPress={() => {
          if (transaction.type === TransactionType.BANK_TRANSFER) {
            setBankTransferData({
              instructions: transaction.sourceDepositInstructions,
              fromActivity: true,
            });
            setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_PREVIEW);
          } else {
            router.push(`/activity/${transaction.clientTxId}`);
          }
        }}
        classNames={{
          container: getTransactionClassName(filteredTransactions, index),
        }}
      />
    );
  };

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
      <FlashList
        key={`flashlist-${showStuckTransactions}`}
        data={filteredTransactions}
        renderItem={renderItem}
        keyExtractor={(item, index) => {
          if (item.type === ActivityGroup.HEADER) {
            return (item.data as TimeGroupHeaderData).key;
          }
          const transaction = item.data as ActivityEvent;
          return transaction.clientTxId || `${transaction.timestamp}-${index}`;
        }}
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
