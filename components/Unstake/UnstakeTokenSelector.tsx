import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { formatUnits } from 'viem';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Text } from '@/components/ui/text';
import { getBridgeChain } from '@/constants/bridge';
import { UNSTAKE_MODAL } from '@/constants/modals';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import getTokenIcon from '@/lib/getTokenIcon';
import { TokenBalance } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import { useUnstakeStore } from '@/store/useUnstakeStore';

const UnstakeTokenSelector: React.FC = () => {
  const { selectedToken, setSelectedToken, setModal } = useUnstakeStore();
  const { ethereumTokens, fuseTokens, baseTokens } = useWalletTokens();

  // Filter for soUSD tokens only (vault tokens)
  const vaultTokens = useMemo(() => {
    const allTokens = [...ethereumTokens, ...fuseTokens, ...baseTokens];
    return allTokens.filter(token => token.contractTickerSymbol?.toLowerCase() === 'sousd');
  }, [ethereumTokens, fuseTokens, baseTokens]);

  // Sort tokens by USD value (descending)
  const sortedTokens = useMemo(() => {
    return vaultTokens.sort((a, b) => {
      const balanceA = Number(formatUnits(BigInt(a.balance || '0'), a.contractDecimals));
      const balanceUSD_A = balanceA * (a.quoteRate || 0);

      const balanceB = Number(formatUnits(BigInt(b.balance || '0'), b.contractDecimals));
      const balanceUSD_B = balanceB * (b.quoteRate || 0);

      return balanceUSD_B - balanceUSD_A; // Descending order
    });
  }, [vaultTokens]);

  const handleTokenSelect = (token: TokenBalance) => {
    setSelectedToken(token);
    setModal(UNSTAKE_MODAL.OPEN_FORM);
  };

  return (
    <View className="gap-4">
      <Text className="text-base font-medium opacity-70">Select an asset</Text>
      <ScrollView className="md:h-[50vh]" showsVerticalScrollIndicator={false}>
        <View className="gap-2">
          {sortedTokens.map(token => {
            const balance = Number(
              formatUnits(BigInt(token.balance) || 0n, token.contractDecimals),
            );

            const balanceUSD = balance * (token.quoteRate || 0);
            const isSelected =
              selectedToken?.contractAddress === token.contractAddress &&
              selectedToken?.chainId === token.chainId;
            return (
              <Pressable
                key={`${token.contractAddress}-${token.chainId}`}
                className={cn(
                  'flex-row items-center justify-between rounded-2xl bg-card px-4 py-4 web:hover:bg-accent/50',
                  isSelected && 'border border-green-500',
                )}
                onPress={() => handleTokenSelect(token)}
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
                      {token.contractTickerSymbol} on {getBridgeChain(token.chainId).name}
                    </Text>
                  </View>
                </View>

                <View className="items-end">
                  <Text className="text-lg font-semibold">${formatNumber(balanceUSD, 2)}</Text>
                  <Text className="text-sm font-medium opacity-50">{formatNumber(balance, 2)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

export default UnstakeTokenSelector;
