import { FlashList } from '@shopify/flash-list';
import React, { memo, useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatUnits } from 'viem';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Text } from '@/components/ui/text';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import getTokenIcon from '@/lib/getTokenIcon';
import { TokenBalance } from '@/lib/types';
import { compactNumberFormat } from '@/lib/utils';

const Title = () => (
  <View className="py-3">
    <Text className="text-lg font-semibold text-muted-foreground">Coins</Text>
  </View>
);

// Memoized token row component to prevent unnecessary re-renders
const TokenRow = memo(
  ({ token }: { token: TokenBalance }) => {
    const balance = Number(formatUnits(BigInt(token.balance || '0'), token.contractDecimals));
    const balanceUSD = balance * (token.quoteRate || 0);

    const tokenIcon = getTokenIcon({
      logoUrl: token.logoUrl,
      tokenSymbol: token.contractTickerSymbol,
      size: 40,
    });

    return (
      <View className="flex-row items-center justify-between p-4 py-5 pr-6 bg-[#1C1C1C] rounded-[20px] mb-2">
        <View className="flex-row items-center gap-3">
          <RenderTokenIcon tokenIcon={tokenIcon} size={40} />
          <View>
            <Text className="font-bold text-lg">{token.contractTickerSymbol || 'Unknown'}</Text>
            <Text className="text-sm font-medium text-muted-foreground">
              {compactNumberFormat(balance)} {token.contractTickerSymbol || 'Unknown'}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-4">
          <Text className="font-bold text-lg">${compactNumberFormat(balanceUSD)}</Text>
        </View>
      </View>
    );
  },
  (prev, next) =>
    prev.token.contractAddress === next.token.contractAddress &&
    prev.token.balance === next.token.balance &&
    prev.token.quoteRate === next.token.quoteRate,
);

TokenRow.displayName = 'TokenRow';

const CoinsMobile = () => {
  const insets = useSafeAreaInsets();
  const { ethereumTokens, fuseTokens } = useWalletTokens();

  // Combine and sort tokens by USD value (descending)
  const allTokens = useMemo(() => {
    const combined = [...ethereumTokens, ...fuseTokens];
    return combined.sort((a, b) => {
      const balanceA = Number(formatUnits(BigInt(a.balance || '0'), a.contractDecimals));
      const balanceUSD_A = balanceA * (a.quoteRate || 0);

      const balanceB = Number(formatUnits(BigInt(b.balance || '0'), b.contractDecimals));
      const balanceUSD_B = balanceB * (b.quoteRate || 0);

      return balanceUSD_B - balanceUSD_A; // Descending order
    });
  }, [ethereumTokens, fuseTokens]);

  const renderItem = useCallback(
    ({ item }: { item: TokenBalance }) => <TokenRow token={item} />,
    [],
  );

  const keyExtractor = useCallback(
    (item: TokenBalance) => `${item.contractAddress}-${item.chainId}`,
    [],
  );

  return (
    <View className="flex-1">
      <Title />
      <FlashList
        data={allTokens}
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

export default CoinsMobile;
