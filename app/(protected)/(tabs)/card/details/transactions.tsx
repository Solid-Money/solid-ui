import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ArrowLeft, ExternalLink, RotateCw } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, View } from 'react-native';

import Loading from '@/components/Loading';
import Navbar from '@/components/Navbar';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { cardTransactionsQueryKey, useCardTransactions } from '@/hooks/useCardTransactions';
import { useDimension } from '@/hooks/useDimension';
import { CardTransaction } from '@/lib/types';

export default function CardTransactions() {
  const { isScreenMedium } = useDimension();
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

  const formatAmount = (amount: string, currency: string) => {
    const numAmount = parseFloat(amount);
    return `${numAmount >= 0 ? '+' : ''}${numAmount.toFixed(2)} ${currency.toUpperCase()}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderTransaction = ({ item }: { item: CardTransaction }) => (
    <View className="flex-row justify-between items-center py-4 border-b border-[#2E2E2E]">
      <View className="flex-1">
        <Text className="text-white text-base font-medium">
          {item.merchant_name || item.description}
        </Text>
        <Text className="text-gray-400 text-sm mt-1">{formatDate(item.posted_at)}</Text>
      </View>
      <View className="flex-row items-center gap-4">
        {item.crypto_transaction_details?.tx_hash && (
          <Pressable
            className="bg-[#2E2E2E] rounded-lg py-2 px-4 web:hover:opacity-70 flex-row items-center gap-2"
            onPress={() => {
              const url = `https://etherscan.io/tx/${item.crypto_transaction_details?.tx_hash}`;
              Linking.openURL(url);
            }}
          >
            <Text className="text-white text-sm font-medium">View transaction</Text>
            <ExternalLink size={14} color="white" />
          </Pressable>
        )}
        <Text
          className={`text-base font-medium ${
            parseFloat(item.amount) >= 0 ? 'text-green-500' : 'text-red-500'
          }`}
        >
          {formatAmount(item.amount, item.currency)}
        </Text>
      </View>
    </View>
  );

  if (isLoading) return <Loading />;

  if (isError) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-gray-400 mb-4">Failed to load transactions</Text>
        <Pressable
          onPress={() => refetch()}
          className="flex-row items-center bg-[#2E2E2E] rounded-lg px-4 py-2"
        >
          <RotateCw size={16} color="white" className="mr-2" />
          <Text className="text-white">Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const allTransactions = data?.pages.flatMap(page => page.data) ?? [];

  return (
    <View className="flex-1 bg-background">
      {isScreenMedium && <Navbar />}

      <View className="flex-1 w-full max-w-[800px] mx-auto">
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
              Transactions
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

        <FlatList
          data={allTransactions}
          renderItem={renderTransaction}
          keyExtractor={item => item.id}
          contentContainerClassName="px-4"
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View className="items-center py-8">
              <Text className="text-gray-400">No transactions yet</Text>
            </View>
          }
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
  );
}
