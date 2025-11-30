import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';

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
  const { activityEvents, activities, getKey, refetchAll } = useActivity();
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

  const getTransactionClassName = (groupedData: TimeGroup[], currentIndex: number) => {
    const classNames = ['bg-card overflow-hidden'];
    let currentGroupStart = -1;
    let currentGroupEnd = -1;

    for (let i = currentIndex; i >= 0; i--) {
      if (groupedData[i].type === ActivityGroup.HEADER) {
        currentGroupStart = i + 1;
        break;
      }
    }

    for (let i = currentIndex; i < groupedData.length; i++) {
      if (groupedData[i].type === ActivityGroup.HEADER && i > currentIndex) {
        currentGroupEnd = i - 1;
        break;
      }
    }

    if (currentGroupEnd === -1) currentGroupEnd = groupedData.length - 1;

    const visibleIndices = [];
    for (let i = currentGroupStart; i <= currentGroupEnd; i++) {
      if (groupedData[i].type === ActivityGroup.TRANSACTION) {
        const transaction = groupedData[i].data as ActivityEvent;
        const isPending = transaction.status === TransactionStatus.PENDING;
        const isCancelled = transaction.status === TransactionStatus.CANCELLED;
        const isStuck = isTransactionStuck(transaction.timestamp);

        if (showStuckTransactions || !((isPending && isStuck) || isCancelled)) {
          visibleIndices.push(i);
        }
      }
    }

    const position = visibleIndices.indexOf(currentIndex);
    if (position === 0) classNames.push('rounded-t-twice');
    if (position === visibleIndices.length - 1) classNames.push('border-b-0 rounded-b-twice');

    return cn(classNames);
  };

  const getTransactionPosition = (currentIndex: number) => {
    let currentGroupStart = -1;
    let currentGroupEnd = -1;

    for (let i = currentIndex; i >= 0; i--) {
      if (filteredTransactions[i].type === ActivityGroup.HEADER) {
        currentGroupStart = i + 1;
        break;
      }
    }

    for (let i = currentIndex; i < filteredTransactions.length; i++) {
      if (filteredTransactions[i].type === ActivityGroup.HEADER && i > currentIndex) {
        currentGroupEnd = i - 1;
        break;
      }
    }

    if (currentGroupEnd === -1) currentGroupEnd = filteredTransactions.length - 1;

    const visibleIndices = [];
    for (let i = currentGroupStart; i <= currentGroupEnd; i++) {
      if (filteredTransactions[i].type === ActivityGroup.TRANSACTION) {
        const transaction = filteredTransactions[i].data as ActivityEvent;
        const isPending = transaction.status === TransactionStatus.PENDING;
        const isCancelled = transaction.status === TransactionStatus.CANCELLED;
        const isStuck = isTransactionStuck(transaction.timestamp);

        if (showStuckTransactions || !((isPending && isStuck) || isCancelled)) {
          visibleIndices.push(i);
        }
      }
    }

    const position = visibleIndices.indexOf(currentIndex);
    return {
      isFirst: position === 0,
      isLast: position === visibleIndices.length - 1,
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

          if (isDirectDeposit) {
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
          container: getTransactionClassName(filteredTransactions, index),
        }}
      />
    );
  };

  const renderLoading = () => (
    <Skeleton className="w-full h-16 bg-card rounded-xl md:rounded-twice" />
  );

  const renderEmpty = () => (
    <View className="py-16 px-4">
      <Text className="text-muted-foreground text-center text-lg">
        {tab === ActivityTab.PROGRESS ? 'No pending transactions' : 'No transactions found'}
      </Text>
      {tab === ActivityTab.WALLET && (
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
            refreshing={isLoading}
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
