import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useShallow } from 'zustand/react/shallow';

import TimeGroupHeader from '@/components/Activity/TimeGroupHeader';
import Transaction from '@/components/Transaction';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useActivity } from '@/hooks/useActivity';
import { useCardDepositPoller } from '@/hooks/useCardDepositPoller';
import { useCardTransactions } from '@/hooks/useCardTransactions';
import { useLayerZeroStatuses } from '@/hooks/useLayerZeroStatuses';
import {
  ActivityEvent,
  ActivityGroup,
  ActivityTab,
  LayerZeroTransactionStatus,
  TransactionStatus,
  TransactionType,
} from '@/lib/types';
import { cn, isTransactionStuck } from '@/lib/utils';
import { deduplicateTransactions } from '@/lib/utils/deduplicateTransactions';
import { groupTransactionsByTime, TimeGroup, TimeGroupHeaderData } from '@/lib/utils/timeGrouping';
import { useDepositStore } from '@/store/useDepositStore';

// Static loading skeleton - extracted outside component to prevent recreation
function LoadingSkeleton() {
  return (
    <View className="gap-3">
      <Skeleton className="h-16 w-full rounded-xl bg-card md:rounded-twice" />
      <Skeleton className="h-16 w-full rounded-xl bg-card md:rounded-twice" />
      <Skeleton className="h-16 w-full rounded-xl bg-card md:rounded-twice" />
    </View>
  );
}

// Static item separator - extracted outside to prevent function recreation on each render
function ItemSeparator() {
  return <View className="h-0" />;
}

type ActivityTransactionsProps = {
  tab?: ActivityTab;
  symbol?: string;
  showTimestamp?: boolean;
};

type RenderItemProps = {
  item: TimeGroup;
  index: number;
};

export default function ActivityTransactions({
  tab = ActivityTab.WALLET,
  symbol,
  showTimestamp = true,
}: ActivityTransactionsProps) {
  const { setModal, setBankTransferData, setDirectDepositSession } = useDepositStore(
    useShallow(state => ({
      setModal: state.setModal,
      setBankTransferData: state.setBankTransferData,
      setDirectDepositSession: state.setDirectDepositSession,
    })),
  );
  const { activityEvents, activities, getKey, refetchAll, isSyncing, isSyncStale } = useActivity();
  const { fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = activityEvents;
  const [showStuckTransactions, setShowStuckTransactions] = useState(false);
  // Ref-based guard to prevent rapid fetchNextPage calls from Load More button
  // React state (isFetchingNextPage) updates async, so multiple clicks could fire
  // before state reflects the pending fetch. This ref updates synchronously.
  const isFetchingRef = useRef(false);
  // Track completed bridge tx hashes using ref to avoid re-render cycles
  // Using useRef instead of useState eliminates the dependency cycle:
  // - useState would cause: useMemo depends on state -> effect updates state -> re-render -> useMemo runs again
  // - useRef breaks this cycle: updates don't trigger re-renders, so no infinite loop possible
  const completedBridgeTxHashesRef = useRef<Set<string>>(new Set());

  const { data: cardData } = useCardTransactions();
  const cardTransactions = useMemo(() => cardData?.pages.flatMap(p => p.data) || [], [cardData]);

  // Identify recent successful bridge deposits to check status for
  // Only check transactions from the last 24 hours to avoid checking history forever
  // Note: completedBridgeTxHashesRef is read here but not in deps array since refs don't trigger re-renders
  // The filtering happens on each render, which is fine since activities changes trigger the re-render anyway
  const bridgeDepositHashes = useMemo(() => {
    const now = Date.now() / 1000;
    return activities
      .filter(
        a =>
          a.type === TransactionType.BRIDGE_DEPOSIT &&
          a.status === TransactionStatus.SUCCESS &&
          a.hash &&
          !completedBridgeTxHashesRef.current.has(a.hash) &&
          now - parseInt(a.timestamp) < 86400,
      )
      .map(a => a.hash)
      .filter(Boolean) as string[];
  }, [activities]);

  const lzStatuses = useLayerZeroStatuses(bridgeDepositHashes);

  const lzStatusMap = useMemo(() => {
    const map = new Map();
    bridgeDepositHashes.forEach((hash, i) => {
      map.set(hash, lzStatuses[i]);
    });
    return map;
  }, [bridgeDepositHashes, lzStatuses]);

  useCardDepositPoller();

  // Mark bridge deposits as completed when they are delivered and found in card transactions
  // This effect updates the ref directly - no re-render cycle possible since refs don't trigger renders
  useEffect(() => {
    for (const transaction of activities) {
      if (
        transaction.type === TransactionType.BRIDGE_DEPOSIT &&
        transaction.status === TransactionStatus.SUCCESS &&
        transaction.hash &&
        !completedBridgeTxHashesRef.current.has(transaction.hash) &&
        lzStatusMap.has(transaction.hash)
      ) {
        const query = lzStatusMap.get(transaction.hash);
        if (!query.data) continue;

        const lzData = query.data.data?.[0];
        const isDelivered = lzData?.status?.name === LayerZeroTransactionStatus.DELIVERED;
        if (!isDelivered) continue;

        const dstTxHash = lzData?.destination?.tx?.txHash;
        if (!dstTxHash) continue;

        const foundInCard = cardTransactions.some(
          ct => ct.crypto_transaction_details?.tx_hash?.toLowerCase() === dstTxHash.toLowerCase(),
        );
        if (foundInCard) {
          // Mark as completed - this is a ref mutation, no re-render triggered
          completedBridgeTxHashesRef.current.add(transaction.hash);
        }
      }
    }
  }, [activities, lzStatusMap, cardTransactions]);

  // Step 1: Override statuses for bridge deposits based on LayerZero status
  // Only recomputes when activities, lzStatusMap, or cardTransactions change
  const updatedActivities = useMemo(() => {
    return activities.map(transaction => {
      if (
        transaction.type === TransactionType.BRIDGE_DEPOSIT &&
        transaction.status === TransactionStatus.SUCCESS &&
        transaction.hash &&
        lzStatusMap.has(transaction.hash)
      ) {
        // If already marked as completed, keep as SUCCESS
        if (completedBridgeTxHashesRef.current.has(transaction.hash)) {
          return transaction;
        }

        const query = lzStatusMap.get(transaction.hash);
        // Default to pending if loading status
        if (!query.data) return { ...transaction, status: TransactionStatus.PENDING };

        const lzData = query.data.data?.[0];
        const isDelivered = lzData?.status?.name === LayerZeroTransactionStatus.DELIVERED;

        if (!isDelivered) {
          return { ...transaction, status: TransactionStatus.PENDING };
        }

        // If delivered, check if it appears in card transactions
        const dstTxHash = lzData?.destination?.tx?.txHash;
        if (!dstTxHash) return { ...transaction, status: TransactionStatus.PENDING };

        const foundInCard = cardTransactions.some(
          ct => ct.crypto_transaction_details?.tx_hash?.toLowerCase() === dstTxHash.toLowerCase(),
        );

        if (!foundInCard) {
          return { ...transaction, status: TransactionStatus.PENDING };
        }
        // Transaction is delivered and found in card - will be marked completed by effect
      }
      return transaction;
    });
  }, [activities, lzStatusMap, cardTransactions]);

  // Step 2: Filter by tab and symbol
  // Only recomputes when updatedActivities, tab, or symbol change
  const tabFilteredActivities = useMemo(() => {
    return updatedActivities.filter(transaction => {
      if (tab === ActivityTab.WALLET) {
        if (symbol) {
          return transaction.symbol?.toLowerCase() === symbol?.toLowerCase();
        }
        return true;
      }
      if (tab === ActivityTab.PROGRESS) {
        return transaction.status === TransactionStatus.PENDING;
      }
      return false;
    });
  }, [updatedActivities, tab, symbol]);

  // Step 3: Deduplicate and group by time
  // Only recomputes when tabFilteredActivities change
  const groupedTransactions = useMemo(() => {
    const deduplicated = deduplicateTransactions(tabFilteredActivities);
    return groupTransactionsByTime(deduplicated);
  }, [tabFilteredActivities]);

  // Step 4: Filter out stuck/cancelled transactions if not showing them
  // Only recomputes when groupedTransactions or showStuckTransactions change
  const filteredTransactions = useMemo(() => {
    if (!showStuckTransactions) {
      return groupedTransactions.filter(item => {
        if (item.type === ActivityGroup.HEADER) return true;
        const transaction = item.data as ActivityEvent;
        const isPending = transaction.status === TransactionStatus.PENDING;
        const isCancelled = transaction.status === TransactionStatus.CANCELLED;
        const isStuck = isTransactionStuck(transaction.timestamp);
        return !((isPending && isStuck) || isCancelled);
      });
    }
    return groupedTransactions;
  }, [groupedTransactions, showStuckTransactions]);

  // Pre-compute group positions for O(1) lookup instead of O(n) per item
  const positionMap = useMemo(() => {
    const map = new Map<number, { isFirst: boolean; isLast: boolean; className: string }>();
    let currentGroupStart = 0;

    for (let i = 0; i < filteredTransactions.length; i++) {
      if (filteredTransactions[i].type === ActivityGroup.HEADER) {
        // Process the previous group
        if (currentGroupStart < i) {
          const groupIndices: number[] = [];
          for (let j = currentGroupStart; j < i; j++) {
            if (filteredTransactions[j].type === ActivityGroup.TRANSACTION) {
              groupIndices.push(j);
            }
          }
          groupIndices.forEach((idx, pos) => {
            const isFirst = pos === 0;
            const isLast = pos === groupIndices.length - 1;
            const classNames = ['bg-card overflow-hidden'];
            if (isFirst) classNames.push('rounded-t-twice');
            if (isLast) classNames.push('border-b-0 rounded-b-twice');
            map.set(idx, { isFirst, isLast, className: cn(classNames) });
          });
        }
        currentGroupStart = i + 1;
      }
    }

    // Process the last group
    if (currentGroupStart < filteredTransactions.length) {
      const groupIndices: number[] = [];
      for (let j = currentGroupStart; j < filteredTransactions.length; j++) {
        if (filteredTransactions[j].type === ActivityGroup.TRANSACTION) {
          groupIndices.push(j);
        }
      }
      groupIndices.forEach((idx, pos) => {
        const isFirst = pos === 0;
        const isLast = pos === groupIndices.length - 1;
        const classNames = ['bg-card overflow-hidden'];
        if (isFirst) classNames.push('rounded-t-twice');
        if (isLast) classNames.push('border-b-0 rounded-b-twice');
        map.set(idx, { isFirst, isLast, className: cn(classNames) });
      });
    }

    return map;
  }, [filteredTransactions]);

  const getTransactionClassName = useCallback(
    (currentIndex: number) => {
      return positionMap.get(currentIndex)?.className ?? 'bg-card overflow-hidden';
    },
    [positionMap],
  );

  const getTransactionPosition = useCallback(
    (currentIndex: number) => {
      const position = positionMap.get(currentIndex);
      return {
        isFirst: position?.isFirst ?? false,
        isLast: position?.isLast ?? false,
      };
    },
    [positionMap],
  );

  // Memoized transaction press handler - takes transaction as param to avoid per-item closures
  const handleTransactionPress = useCallback(
    (transaction: ActivityEvent) => {
      const clientTxId = transaction.clientTxId;
      const isDirectDeposit = clientTxId?.startsWith('direct_deposit_');
      const isPending = transaction.status === TransactionStatus.PENDING;
      const isProcessing = transaction.status === TransactionStatus.PROCESSING;
      const isPendingOrProcessing = isPending || isProcessing;

      if (isDirectDeposit && isPendingOrProcessing) {
        const sessionId = clientTxId.replace('direct_deposit_', '');
        // Seed the store for the address screen and mark it as coming from activity
        setDirectDepositSession({
          sessionId,
          chainId: transaction.chainId,
          status: 'pending',
          fromActivity: true,
        });
        // Open global modal
        setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY_ADDRESS);
      } else if (transaction.type === TransactionType.BANK_TRANSFER) {
        setBankTransferData({
          instructions: transaction.metadata?.sourceDepositInstructions,
          fromActivity: true,
        });
        setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_PREVIEW);
      } else {
        router.push(`/activity/${transaction.clientTxId}?tab=${tab}`);
      }
    },
    [tab, setDirectDepositSession, setModal, setBankTransferData],
  );

  const renderItem = useCallback(
    ({ item, index }: RenderItemProps) => {
      if (item.type === ActivityGroup.HEADER) {
        const headerData = item.data as TimeGroupHeaderData;

        return (
          <TimeGroupHeader
            index={index}
            title={headerData.title}
            isPending={headerData.status === TransactionStatus.PENDING}
            showStuck={showStuckTransactions}
            onToggleStuck={setShowStuckTransactions}
            hasActivePendingTransactions={headerData.hasActivePendingTransactions}
          />
        );
      }

      const transaction = item.data as ActivityEvent;
      const { isFirst, isLast } = getTransactionPosition(index);

      return (
        <Transaction
          {...transaction}
          title={transaction.title}
          showTimestamp={showTimestamp}
          isFirst={isFirst}
          isLast={isLast}
          onPress={() => handleTransactionPress(transaction)}
          classNames={{
            container: getTransactionClassName(index),
          }}
        />
      );
    },
    [
      showStuckTransactions,
      showTimestamp,
      getTransactionPosition,
      getTransactionClassName,
      handleTransactionPress,
    ],
  );

  const renderSyncingIndicator = () => {
    if (!isSyncing) return null;
    return (
      <View className="flex-row items-center justify-center gap-2 py-2">
        <View className="h-2 w-2 animate-pulse rounded-full bg-primary" />
        <Text className="text-sm text-muted-foreground">
          {isSyncStale ? 'Syncing your transaction history...' : 'Syncing...'}
        </Text>
      </View>
    );
  };

  const renderEmpty = useCallback(
    () => (
      <View className="px-4 py-16">
        {isSyncing && isSyncStale ? (
          <>
            <Text className="text-center text-lg text-muted-foreground">
              Syncing your transaction history...
            </Text>
            <Text className="mt-2 text-center text-sm text-muted-foreground">
              This may take a moment for new accounts
            </Text>
            <View className="mt-4">
              <LoadingSkeleton />
            </View>
          </>
        ) : (
          <>
            <Text className="text-center text-lg text-muted-foreground">
              {tab === ActivityTab.PROGRESS ? 'No pending transactions' : 'No transactions found'}
            </Text>
            {tab === ActivityTab.WALLET && (
              <Text className="mt-2 text-center text-sm text-muted-foreground">
                Start by making a swap or sending tokens
              </Text>
            )}
          </>
        )}
      </View>
    ),
    [isSyncing, isSyncStale, tab],
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetchingRef.current) {
      isFetchingRef.current = true;
      fetchNextPage().finally(() => {
        isFetchingRef.current = false;
      });
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderFooter = useCallback(() => {
    if (hasNextPage) {
      return (
        <View className="items-center py-7">
          <Pressable
            onPress={handleLoadMore}
            disabled={isFetchingNextPage}
            className={cn(
              'flex-row items-center gap-2 rounded-lg bg-card px-6 py-3',
              isFetchingNextPage ? 'opacity-70' : 'active:opacity-70',
            )}
          >
            {isFetchingNextPage && <ActivityIndicator size="small" color="gray" />}
            <Text className="text-base font-medium text-foreground">
              {isFetchingNextPage ? 'Loading...' : 'Load More'}
            </Text>
          </Pressable>
        </View>
      );
    }
    return null;
  }, [hasNextPage, isFetchingNextPage, handleLoadMore]);

  // Memoized key extractor for FlashList - stable reference improves performance
  const keyExtractor = useCallback(
    (item: TimeGroup, index: number) => {
      if (item.type === ActivityGroup.HEADER) {
        const headerKey = (item.data as TimeGroupHeaderData).key;
        // Ensure header keys are always prefixed and unique
        return headerKey.startsWith('header-')
          ? `${headerKey}-${index}`
          : `header-${headerKey}-${index}`;
      }
      const transaction = item.data as ActivityEvent;
      // Get base key, ensuring it's never empty
      const hashKey = getKey(transaction);
      const baseKey =
        (hashKey && hashKey.trim()) ||
        transaction.clientTxId ||
        transaction.timestamp ||
        `unknown-${index}`;
      // Ensure key is always unique and non-empty
      // Prefix with 'tx-' to avoid collisions with headers, add index for uniqueness
      return `tx-${baseKey}-${index}`;
    },
    [getKey],
  );

  // Show full loading state only for first load with stale data
  if (isLoading && !filteredTransactions.length && isSyncStale) {
    return (
      <View className="flex-1 px-4">
        <View className="py-8">
          <Text className="mb-2 text-center text-lg text-muted-foreground">
            Syncing your transaction history...
          </Text>
          <Text className="mb-4 text-center text-sm text-muted-foreground">
            This may take a moment for new accounts
          </Text>
        </View>
        <LoadingSkeleton />
      </View>
    );
  }

  const isWeb = Platform.OS === 'web';

  return (
    <View className="flex-1">
      {/* Subtle syncing indicator for background syncs (native only) */}
      {!isWeb && renderSyncingIndicator()}

      <FlashList
        key={`flashlist-${showStuckTransactions}`}
        data={filteredTransactions}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // NOTE: onEndReached was intentionally removed to prevent bulk page fetches
        // FlashList fires onEndReached on every re-render when content doesn't fill viewport
        // This caused all pages to fetch immediately (Sentry: "10+ renders/second")
        // Users now use the "Load More" button instead (renderFooter)
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        ItemSeparatorComponent={ItemSeparator}
        contentContainerStyle={{ paddingVertical: 0, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || isSyncing}
            onRefresh={refetchAll}
            tintColor="#666"
            colors={['#666']}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
