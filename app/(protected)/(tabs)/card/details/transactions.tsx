import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ArrowLeft, RotateCw } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, View } from 'react-native';

import Loading from '@/components/Loading';
import PageLayout from '@/components/PageLayout';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import TransactionDrawer from '@/components/Transaction/TransactionDrawer';
import TransactionDropdown from '@/components/Transaction/TransactionDropdown';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { cardTransactionsQueryKey, useCardTransactions } from '@/hooks/useCardTransactions';
import getTokenIcon from '@/lib/getTokenIcon';
import { CardTransaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatCardAmountWithCurrency } from '@/lib/utils/cardHelpers';

export default function CardTransactions() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    refetch,
    isFetching,
  } = useCardTransactions();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTransactionClassName = (totalTransactions: number, index: number) => {
    // Remove bottom border for last item only
    if (index === totalTransactions - 1) return 'border-b-0';
    return '';
  };

  const renderTransaction = ({ item, index }: { item: CardTransaction; index: number }) => {
    const tokenIcon = getTokenIcon({
      tokenSymbol: item.currency?.toUpperCase(),
      size: 34,
    });

    const transactionUrl = item.crypto_transaction_details?.tx_hash
      ? `https://etherscan.io/tx/${item.crypto_transaction_details.tx_hash}`
      : undefined;

    return (
      <Pressable
        className={cn(
          'flex-row items-center justify-between p-4 md:px-6',
          'border-b border-border/40',
          getTransactionClassName(allTransactions.length, index),
        )}
      >
        <View className="flex-row items-center gap-2 md:gap-4 flex-1 mr-2">
          <RenderTokenIcon tokenIcon={tokenIcon} size={34} />
          <View className="flex-1">
            <Text className="text-lg font-medium" numberOfLines={1}>
              {item.merchant_name || item.description}
            </Text>
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {formatDate(item.posted_at)}
              {', '}
              {formatTime(item.posted_at)}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2 md:gap-10 flex-shrink-0">
          <Text className={`font-bold text-right text-white`}>
            {formatCardAmountWithCurrency(item.amount, item.currency)}
          </Text>
          {Platform.OS === 'web' ? (
            <TransactionDropdown url={transactionUrl} />
          ) : (
            <TransactionDrawer url={transactionUrl} />
          )}
        </View>
      </Pressable>
    );
  };

  const allTransactions = data?.pages.flatMap(page => page.data) ?? [];

  if (isError && !isLoading) {
    return (
      <PageLayout desktopOnly scrollable={false}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 mb-4">Failed to load transactions</Text>
          <Pressable
            onPress={() => refetch()}
            className="flex-row items-center bg-[#2E2E2E] rounded-lg px-4 py-2"
          >
            <RotateCw size={16} color="white" className="mr-2" />
            <Text className="text-white">Try Again</Text>
          </Pressable>
        </View>
      </PageLayout>
    );
  }

  return (
    <PageLayout desktopOnly scrollable={false} isLoading={isLoading}>
      <View className="flex-1 w-full max-w-[600px] mx-auto">
        <View className="px-8 pt-8">
          <View className="flex-row items-center justify-between mb-8">
            <Pressable
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace(path.CARD_DETAILS)
              }
              className="web:hover:opacity-70"
            >
              <ArrowLeft color="white" />
            </Pressable>
            <Text className="text-white text-xl md:text-2xl font-semibold text-center">
              Solid card transactions
            </Text>
            <Pressable
              onPress={() => {
                queryClient.invalidateQueries({ queryKey: cardTransactionsQueryKey });
              }}
              className="web:hover:opacity-70"
            >
              {isFetching ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <RotateCw color="white" />
              )}
            </Pressable>
          </View>
        </View>

        {allTransactions.length ? (
          <View className="flex-1 px-4">
            <View className="bg-card rounded-xl md:rounded-twice overflow-hidden flex-1">
              <FlatList
                data={allTransactions}
                renderItem={renderTransaction}
                keyExtractor={item => item.id}
                onEndReached={() => {
                  if (hasNextPage && !isFetchingNextPage) {
                    fetchNextPage();
                  }
                }}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                  isFetchingNextPage ? (
                    <View className="py-4">
                      <Loading />
                    </View>
                  ) : null
                }
              />
            </View>
          </View>
        ) : (
          <View className="items-center py-8 px-4">
            <Text className="text-muted-foreground">No transactions yet</Text>
          </View>
        )}
      </View>
    </PageLayout>
  );
}
