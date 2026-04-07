import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { formatUnits } from 'viem';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Text } from '@/components/ui/text';
import { getBridgeChain } from '@/constants/bridge';
import getTokenIcon from '@/lib/getTokenIcon';
import { TokenBalance } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';

interface WalletTokenListProps {
  tokens: TokenBalance[];
  selectedToken?: TokenBalance | null;
  onSelect: (token: TokenBalance) => void;
  emptyMessage?: string;
  emptyDescription?: string;
}

/**
 * Scrollable token list showing tokens with chain names and balances.
 * Reused by withdraw (UnstakeTokenSelector) and deposit (SavingsDepositTokenSelector).
 */
const WalletTokenList: React.FC<WalletTokenListProps> = ({
  tokens,
  selectedToken,
  onSelect,
  emptyMessage = 'No tokens found',
  emptyDescription,
}) => {
  // Sort by USD value descending
  const sortedTokens = useMemo(() => {
    return [...tokens].sort((a, b) => {
      const balanceA = Number(formatUnits(BigInt(a.balance || '0'), a.contractDecimals));
      const balanceUSD_A = balanceA * (a.quoteRate || 0);
      const balanceB = Number(formatUnits(BigInt(b.balance || '0'), b.contractDecimals));
      const balanceUSD_B = balanceB * (b.quoteRate || 0);
      return balanceUSD_B - balanceUSD_A;
    });
  }, [tokens]);

  if (sortedTokens.length === 0) {
    return (
      <View className="items-center justify-center gap-4 py-12">
        <Text className="text-lg font-medium text-muted-foreground">{emptyMessage}</Text>
        {emptyDescription && (
          <Text className="text-center text-sm text-muted-foreground">{emptyDescription}</Text>
        )}
      </View>
    );
  }

  return (
    <ScrollView className="md:h-[50vh]" showsVerticalScrollIndicator={false}>
      <View className="gap-2">
        {sortedTokens.map(token => {
          const balance = Number(
            formatUnits(BigInt(token.balance || '0'), token.contractDecimals),
          );
          const balanceUSD = balance * (token.quoteRate || 0);
          const isSelected =
            selectedToken?.contractAddress === token.contractAddress &&
            selectedToken?.chainId === token.chainId;
          const chainName = getBridgeChain(token.chainId)?.name || `Chain ${token.chainId}`;

          return (
            <Pressable
              key={`${token.contractAddress}-${token.chainId}`}
              className={cn(
                'flex-row items-center justify-between rounded-2xl bg-card px-4 py-4 web:hover:bg-accent/50',
                isSelected && 'border border-green-500',
              )}
              onPress={() => onSelect(token)}
            >
              <View className="flex-1 flex-row items-center gap-3">
                <RenderTokenIcon
                  tokenIcon={getTokenIcon({
                    logoUrl: token.logoUrl,
                    tokenSymbol: token.contractTickerSymbol,
                    size: 40,
                  })}
                  size={40}
                />
                <View className="flex-1">
                  <Text className="text-lg font-semibold">{token.contractTickerSymbol}</Text>
                  <Text className="text-sm font-medium opacity-50">
                    {token.contractTickerSymbol} on {chainName}
                  </Text>
                </View>
              </View>

              <View className="items-end">
                <Text className="text-lg font-semibold">${formatNumber(balanceUSD, 2)}</Text>
                <Text className="text-sm font-medium opacity-50">
                  {formatNumber(balance, 2)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
};

export default WalletTokenList;
