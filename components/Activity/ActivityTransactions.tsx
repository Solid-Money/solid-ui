import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, RefreshControl, View } from 'react-native';

import TimeGroupHeader from '@/components/Activity/TimeGroupHeader';
import Transaction from '@/components/Transaction';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useActivity } from '@/hooks/useActivity';
import { useCardDepositPoller } from '@/hooks/useCardDepositPoller';
import {
  ActivityEvent,
  ActivityGroup,
  ActivityTab,
  TransactionStatus,
  TransactionType,
} from '@/lib/types';
import { cn, isTransactionStuck } from '@/lib/utils';
import { deduplicateTransactions } from '@/lib/utils/deduplicateTransactions';
import { groupTransactionsByTime, TimeGroup, TimeGroupHeaderData } from '@/lib/utils/timeGrouping';
import { useDepositStore } from '@/store/useDepositStore';

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
  const { setModal, setBankTransferData, setDirectDepositSession } = useDepositStore();
  const { activityEvents, activities, getKey, refetchAll, isSyncing, isSyncStale } = useActivity();
  const { fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = activityEvents;
  const [showStuckTransactions, setShowStuckTransactions] = useState(false);
  useCardDepositPoller();

  const filteredTransactions = useMemo(() => {
    const filtered = activities.filter(transaction => {
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

    const deduplicated = deduplicateTransactions(filtered);
    const grouped = groupTransactionsByTime(deduplicated);

    // Filter out stuck/cancelled transactions if not showing them
    if (!showStuckTransactions) {
      return grouped.filter(item => {
        if (item.type === ActivityGroup.HEADER) return true;
        const transaction = item.data as ActivityEvent;
        const isPending = transaction.status === TransactionStatus.PENDING;
        const isCancelled = transaction.status === TransactionStatus.CANCELLED;
        const isStuck = isTransactionStuck(transaction.timestamp);
        return !((isPending && isStuck) || isCancelled);
      });
    }
    return grouped;
  }, [activities, tab, symbol, showStuckTransactions]);

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

  const getTransactionClassName = (currentIndex: number) => {
    return positionMap.get(currentIndex)?.className ?? 'bg-card overflow-hidden';
  };

  const getTransactionPosition = (currentIndex: number) => {
    const position = positionMap.get(currentIndex);
    return {
      isFirst: position?.isFirst ?? false,
      isLast: position?.isLast ?? false,
    };
  };

  const renderItem = ({ item, index }: RenderItemProps) => {
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
        onPress={() => {
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
              instructions: transaction.sourceDepositInstructions,
              fromActivity: true,
            });
            setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_PREVIEW);
          } else {
            router.push(`/activity/${transaction.clientTxId}?tab=${tab}`);
          }
        }}
        classNames={{
          container: getTransactionClassName(index),
        }}
      />
    );
  };

  const renderLoading = () => (
    <View className="gap-3">
      <Skeleton className="w-full h-16 bg-card rounded-xl md:rounded-twice" />
      <Skeleton className="w-full h-16 bg-card rounded-xl md:rounded-twice" />
      <Skeleton className="w-full h-16 bg-card rounded-xl md:rounded-twice" />
    </View>
  );

  const renderSyncingIndicator = () => {
    if (!isSyncing) return null;
    return (
      <View className="flex-row items-center justify-center py-2 gap-2">
        <View className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <Text className="text-muted-foreground text-sm">
          {isSyncStale ? 'Syncing your transaction history...' : 'Syncing...'}
        </Text>
      </View>
    );
  };

  const renderEmpty = () => (
    <View className="py-16 px-4">
      {isSyncing && isSyncStale ? (
        <>
          <Text className="text-muted-foreground text-center text-lg">
            Syncing your transaction history...
          </Text>
          <Text className="text-muted-foreground text-center text-sm mt-2">
            This may take a moment for new accounts
          </Text>
          <View className="mt-4">{renderLoading()}</View>
        </>
      ) : (
        <>
          <Text className="text-muted-foreground text-center text-lg">
            {tab === ActivityTab.PROGRESS ? 'No pending transactions' : 'No transactions found'}
          </Text>
          {tab === ActivityTab.WALLET && (
            <Text className="text-muted-foreground text-center text-sm mt-2">
              Start by making a swap or sending tokens
            </Text>
          )}
        </>
      )}
    </View>
  );

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return renderLoading();
    }
    return null;
  };

  // Show full loading state only for first load with stale data
  if (isLoading && !filteredTransactions.length && isSyncStale) {
    return (
      <View className="flex-1 px-4">
        <View className="py-8">
          <Text className="text-muted-foreground text-center text-lg mb-2">
            Syncing your transaction history...
          </Text>
          <Text className="text-muted-foreground text-center text-sm mb-4">
            This may take a moment for new accounts
          </Text>
        </View>
        {renderLoading()}
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
        keyExtractor={(item, index) => {
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
          // Use a combination of identifiers to ensure uniqueness even if hash/userOpHash/clientTxId are the same
          return `tx-${baseKey}-${index}`;
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
