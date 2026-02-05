import { useMemo } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';

import Diamond from '@/assets/images/diamond';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Text } from '@/components/ui/text';
import { useActivity } from '@/hooks/useActivity';
import { useCardTransactions } from '@/hooks/useCardTransactions';
import { useCashbacks } from '@/hooks/useCashbacks';
import getTokenIcon from '@/lib/getTokenIcon';
import {
  ActivityEvent,
  ActivityGroup,
  ActivityTab,
  CardTransaction,
  CardTransactionCategory,
  TransactionType,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  formatCardAmount,
  getCashbackAmount,
  getColorForTransaction,
  getInitials,
} from '@/lib/utils/cardHelpers';
import { groupByTime, TimeGroup } from '@/lib/utils/timeGrouping';

type CardTransactionWithTimestamp = CardTransaction & { timestamp: number; source: 'card' };
type CardWithdrawalActivity = Omit<ActivityEvent, 'timestamp'> & {
  timestamp: number;
  source: 'activity';
};
type CardListItem = CardTransactionWithTimestamp | CardWithdrawalActivity;

type RenderItemProps = {
  item: TimeGroup<CardListItem>;
  index: number;
};

export default function CardTransactions() {
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useCardTransactions();
  const { data: cashbacks } = useCashbacks();
  const { activities } = useActivity();

  const transactions = useMemo(() => {
    return data?.pages.flatMap(page => page.data) ?? [];
  }, [data]);

  const cardWithdrawals = useMemo(
    () =>
      activities
        .filter(a => a.type === TransactionType.CARD_WITHDRAWAL)
        .map(a => ({ ...a, timestamp: Number(a.timestamp), source: 'activity' as const })),
    [activities],
  );

  const mergedItems = useMemo(() => {
    const cardItems: CardTransactionWithTimestamp[] = transactions
      .filter(tx => tx.category !== CardTransactionCategory.CRYPTO_WITHDRAWAL)
      .map(tx => {
        const dateStr =
          tx.status === 'approved'
            ? tx.authorized_at || tx.posted_at
            : tx.posted_at || tx.authorized_at;
        const timestamp = dateStr ? new Date(dateStr).getTime() / 1000 : Date.now() / 1000;
        return {
          ...tx,
          timestamp,
          source: 'card' as const,
        };
      });
    const all: CardListItem[] = [...cardItems, ...cardWithdrawals];
    all.sort((a, b) => b.timestamp - a.timestamp);
    return all;
  }, [transactions, cardWithdrawals]);

  const isFirstInGroup = (groupedData: TimeGroup<CardListItem>[], currentIndex: number) => {
    // Check if previous item is a header
    if (currentIndex === 0) return true;
    return groupedData[currentIndex - 1]?.type === ActivityGroup.HEADER;
  };

  const isLastInGroup = (groupedData: TimeGroup<CardListItem>[], currentIndex: number) => {
    // Check if next item is a header or if this is the last item
    if (currentIndex === groupedData.length - 1) return true;
    return (
      groupedData[currentIndex + 1]?.type === ActivityGroup.HEADER ||
      currentIndex === groupedData.length - 1
    );
  };

  const groupedTransactions = useMemo(() => {
    return groupByTime(mergedItems);
  }, [mergedItems]);

  const renderItem = ({ item, index }: RenderItemProps) => {
    if (item.type === ActivityGroup.HEADER) {
      return (
        <View className="py-3">
          <Text className="font-semibold text-muted-foreground">{item.data.title}</Text>
        </View>
      );
    }

    const row = item.data;
    const isFirst = isFirstInGroup(groupedTransactions, index);
    const isLast = isLastInGroup(groupedTransactions, index);

    if (row.source === 'activity') {
      const activity = row as CardWithdrawalActivity;
      const amount = parseFloat(activity.amount);
      const formattedAmount =
        amount >= 0 ? `-$${Math.abs(amount).toFixed(2)}` : `$${Math.abs(amount).toFixed(2)}`;
      return (
        <Pressable
          key={`${activity.clientTxId}-${index}`}
          onPress={() => router.push(`/activity/${activity.clientTxId}?tab=${ActivityTab.CARD}`)}
          className={cn(
            'flex-row items-center justify-between bg-[#1C1C1E] px-4 py-4',
            !isLast && 'border-b border-[#2C2C2E]',
            isFirst && 'rounded-t-[20px]',
            isLast && 'rounded-b-[20px]',
          )}
        >
          <View className="mr-4 flex-1 flex-row items-center gap-3">
            <RenderTokenIcon
              tokenIcon={getTokenIcon({
                tokenSymbol: activity.symbol,
                size: 44,
              })}
              size={44}
            />
            <View className="flex-1">
              <Text className="text-lg font-medium text-white" numberOfLines={1}>
                {activity.title}
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-xl font-semibold text-white">{formattedAmount}</Text>
          </View>
        </Pressable>
      );
    }

    const transaction = row as CardTransactionWithTimestamp;
    const merchantName = transaction.merchant_name || transaction.description || 'Unknown';
    const initials = getInitials(merchantName);
    const isPurchase = transaction.category === CardTransactionCategory.PURCHASE;
    const color = getColorForTransaction(merchantName);
    const cashbackInfo = getCashbackAmount(transaction.id, cashbacks);

    return (
      <Pressable
        key={`${transaction.id}-${index}`}
        onPress={() => router.push(`/activity/card-${transaction.id}?tab=${ActivityTab.CARD}`)}
        className={cn(
          'flex-row items-center justify-between bg-[#1C1C1E] px-4 py-4',
          !isLast && 'border-b border-[#2C2C2E]',
          isFirst && 'rounded-t-[20px]',
          isLast && 'rounded-b-[20px]',
        )}
      >
        <View className="mr-4 flex-1 flex-row items-center gap-3">
          {isPurchase ? (
            <View
              className="h-[44px] w-[44px] items-center justify-center rounded-full"
              style={{ backgroundColor: color.bg }}
            >
              <Text className="text-lg font-semibold" style={{ color: color.text }}>
                {initials}
              </Text>
            </View>
          ) : (
            <RenderTokenIcon
              tokenIcon={getTokenIcon({
                tokenSymbol: transaction.currency?.toUpperCase(),
                size: 44,
              })}
              size={44}
            />
          )}
          <View className="flex-1">
            <Text className="text-lg font-medium text-white" numberOfLines={1}>
              {merchantName}
            </Text>
            {cashbackInfo && (
              <View className="mt-0.5 flex-row items-center gap-1">
                <Diamond />
                <Text className="text-sm text-[#8E8E93]">
                  {cashbackInfo.isPending ? 'Cashback (Pending)' : 'Cashback'}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View className="items-end">
          <Text className="text-xl font-semibold text-white">
            {formatCardAmount(transaction.amount)}
          </Text>
          {cashbackInfo && (
            <Text className="mt-0.5 text-sm font-medium text-[#34C759]">{cashbackInfo.amount}</Text>
          )}
        </View>
      </Pressable>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View className="items-center px-4 py-16">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      );
    }

    if (error) {
      return (
        <View className="px-4 py-16">
          <Text className="text-center text-lg text-muted-foreground">
            Error loading transactions
          </Text>
          <Text className="mt-2 text-center text-sm text-muted-foreground">{error.message}</Text>
        </View>
      );
    }

    return (
      <View className="px-4 py-16">
        <Text className="text-center text-lg text-muted-foreground">
          No card transactions found
        </Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">
          Your card transactions will appear here
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View className="items-center py-4">
        <ActivityIndicator size="small" color="#fff" />
      </View>
    );
  };

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return (
    <View className="flex-1">
      <FlashList
        data={groupedTransactions}
        renderItem={renderItem}
        keyExtractor={(item, index) => {
          if (item.type === ActivityGroup.HEADER) {
            return item.data.key;
          }
          const row = item.data as CardListItem;
          if (row.source === 'activity') return row.clientTxId;
          return row.id || `${index}`;
        }}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        ItemSeparatorComponent={() => null}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}
