import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import Diamond from '@/assets/images/diamond';
import { Text } from '@/components/ui/text';
import { useCardTransactions } from '@/hooks/useCardTransactions';
import { ActivityGroup, ActivityTab, CardTransaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  formatCardAmount,
  getAvatarColor,
  getCashbackAmount,
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
        <View className="pt-6 pb-3">
          <Text className="text-base text-[#8E8E93] font-medium">{item.data.title}</Text>
        </View>
      );
    }

    // TypeScript now knows item.data is CardTransactionWithTimestamp
    const transaction = item.data;
    const merchantName = transaction.merchant_name || transaction.description || 'Unknown';
    const initials = getInitials(merchantName);
    const avatarColor = getAvatarColor(merchantName);
    const isFirst = isFirstInGroup(groupedTransactions, index);
    const isLast = isLastInGroup(groupedTransactions, index);

    return (
      <Pressable
        key={`${transaction.id}-${index}`}
        onPress={() => router.push(`/activity/card-${transaction.id}?tab=${ActivityTab.CARD}`)}
        className={cn(
          'flex-row items-center justify-between px-4 py-4 bg-[#1C1C1E]',
          !isLast && 'border-b border-[#2C2C2E]',
          isFirst && 'rounded-t-[20px]',
          isLast && 'rounded-b-[20px]',
        )}
      >
        <View className="flex-row items-center gap-3 flex-1 mr-4">
          {/* Avatar with initials */}
          <View className={cn('w-14 h-14 rounded-full items-center justify-center', avatarColor)}>
            <Text className="text-white text-lg font-semibold">{initials}</Text>
          </View>

          {/* Merchant name and cashback */}
          <View className="flex-1">
            <Text className="text-lg font-medium text-white" numberOfLines={1}>
              {merchantName}
            </Text>
            <View className="flex-row items-center gap-1 mt-0.5">
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
          <Text className="text-sm font-medium text-[#34C759] mt-0.5">{getCashbackAmount()}</Text>
        </View>
      </Pressable>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View className="py-16 px-4 items-center">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      );
    }

    if (error) {
      return (
        <View className="py-16 px-4">
          <Text className="text-muted-foreground text-center text-lg">
            Error loading transactions
          </Text>
          <Text className="text-muted-foreground text-center text-sm mt-2">{error.message}</Text>
        </View>
      );
    }

    return (
      <View className="py-16 px-4">
        <Text className="text-muted-foreground text-center text-lg">
          No card transactions found
        </Text>
        <Text className="text-muted-foreground text-center text-sm mt-2">
          Your card transactions will appear here
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View className="py-4 items-center">
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
        estimatedItemSize={88}
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
