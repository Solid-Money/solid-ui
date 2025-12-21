import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TokenBalance } from '@/lib/types';

import TokenCard from './TokenCard';
import { TokenListProps } from './types';

const TokenListMobile = ({ tokens }: TokenListProps) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleTokenPress = useCallback(
    (token: TokenBalance) => {
      router.push(`/coins/${token.chainId}-${token.contractAddress}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: TokenBalance }) => (
      <TokenCard token={item} onPress={() => handleTokenPress(item)} />
    ),
    [handleTokenPress],
  );

  const keyExtractor = useCallback(
    (item: TokenBalance) => `${item.chainId}-${item.contractAddress}`,
    [],
  );

  return (
    <View className="flex-1" style={{ minHeight: 200 }}>
      <FlashList
        data={tokens}
        estimatedItemSize={72}
        contentContainerStyle={{
          paddingBottom: insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
      />
    </View>
  );
};

export default TokenListMobile;
