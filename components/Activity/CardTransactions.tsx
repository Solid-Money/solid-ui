import { useMemo } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';

import Diamond from '@/assets/images/diamond';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Text } from '@/components/ui/text';
import { useCardTransactions } from '@/hooks/useCardTransactions';
import { useCashbacks } from '@/hooks/useCashbacks';
import getTokenIcon from '@/lib/getTokenIcon';
import { ActivityGroup, ActivityTab, CardTransaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  formatCardAmount,
  getCashbackAmount,
  getColorForTransaction,
  getInitials,
} from '@/lib/utils/cardHelpers';
import { groupByTime, TimeGroup } from '@/lib/utils/timeGrouping';

type CardTransactionWithTimestamp = CardTransaction & { timestamp: number };

type RenderItemProps = {
  item: TimeGroup<CardTransactionWithTimestamp>;
  index: number;
};

export default function CardTransactions() {
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useCardTransactions();
  const { data: cashbacks } = useCashbacks();

  const transactions = useMemo(() => {
    return data?.pages.flatMap(page => page.data) ?? [];
  }, [data]);

  const isFirstInGroup = (
    groupedData: TimeGroup<CardTransactionWithTimestamp>[],
    currentIndex: number,
  ) => {
    // Check if previous item is a header
    if (currentIndex === 0) return true;
    return groupedData[currentIndex - 1]?.type === ActivityGroup.HEADER;
  };

  const isLastInGroup = (
    groupedData: TimeGroup<CardTransactionWithTimestamp>[],
    currentIndex: number,
  ) => {
    // Check if next item is a header or if this is the last item
    if (currentIndex === groupedData.length - 1) return true;
    return (
      groupedData[currentIndex + 1]?.type === ActivityGroup.HEADER ||
      currentIndex === groupedData.length - 1
    );
  };

  // Convert card transactions to a format compatible with time grouping
  const formattedTransactions = useMemo(() => {
    return transactions.map(tx => ({
      ...tx,
      timestamp: new Date(tx.posted_at).getTime() / 1000,
    }));
  }, [transactions]);

  const groupedTransactions = useMemo(() => {
    return groupByTime(formattedTransactions);
  }, [formattedTransactions]);

  const renderItem = ({ item, index }: RenderItemProps) => {
    if (item.type === ActivityGroup.HEADER) {
      return (
        <View className="py-3">
          <Text className="font-semibold text-muted-foreground">{item.data.title}</Text>
        </View>
      );
    }

    // TypeScript now knows item.data is CardTransactionWithTimestamp
    const transaction = item.data;
    const merchantName = transaction.merchant_name || transaction.description || 'Unknown';
    const initials = getInitials(merchantName);
    const isPurchase = transaction.category === 'purchase';
    const color = getColorForTransaction(merchantName);
    const isFirst = isFirstInGroup(groupedTransactions, index);
    const isLast = isLastInGroup(groupedTransactions, index);

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
          {/* Avatar with initials */}
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

          {/* Merchant name and cashback */}
          <View className="flex-1">
            <Text className="text-lg font-medium text-white" numberOfLines={1}>
              {merchantName}
            </Text>
            <View className="mt-0.5 flex-row items-center gap-1">
              <Diamond />
              <Text className="text-sm text-[#8E8E93]">Cashback</Text>
            </View>
          </View>
        </View>

        {/* Amount and cashback */}
        <View className="items-end">
          <Text className="text-xl font-semibold text-white">
            {formatCardAmount(transaction.amount)}
          </Text>
          <Text className="mt-0.5 text-sm font-medium text-[#34C759]">
            {getCashbackAmount(transaction.id, cashbacks)}
          </Text>
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
          return item.data.id || `${index}`;
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
