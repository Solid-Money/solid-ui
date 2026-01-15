import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { formatUnits } from 'viem';
import { useShallow } from 'zustand/react/shallow';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Text } from '@/components/ui/text';
import { getBridgeChain } from '@/constants/bridge';
import { SEND_MODAL } from '@/constants/modals';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import getTokenIcon from '@/lib/getTokenIcon';
import { TokenBalance } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import { useSendStore } from '@/store/useSendStore';

import ToInput from './ToInput';

const TokenSelector: React.FC = () => {
  // Use useShallow for object selection to prevent unnecessary re-renders
  const { selectedToken, setSelectedToken, setModal } = useSendStore(
    useShallow(state => ({
      selectedToken: state.selectedToken,
      setSelectedToken: state.setSelectedToken,
      setModal: state.setModal,
    })),
  );
  const { ethereumTokens, fuseTokens, baseTokens } = useWalletTokens();

  // Combine and sort tokens by USD value (descending)
  const allTokens = useMemo(() => {
    const combined = [...ethereumTokens, ...fuseTokens, ...baseTokens];
    return combined.sort((a, b) => {
      const balanceA = Number(formatUnits(BigInt(a.balance || '0'), a.contractDecimals));
      const balanceUSD_A = balanceA * (a.quoteRate || 0);

      const balanceB = Number(formatUnits(BigInt(b.balance || '0'), b.contractDecimals));
      const balanceUSD_B = balanceB * (b.quoteRate || 0);

      return balanceUSD_B - balanceUSD_A; // Descending order
    });
  }, [ethereumTokens, fuseTokens, baseTokens]);

  const handleTokenSelect = (token: TokenBalance) => {
    setSelectedToken(token);
    setModal(SEND_MODAL.OPEN_FORM);
  };

  return (
    <View className="gap-8">
      <ToInput />

      <View className="gap-4">
        <Text className="text-base font-medium opacity-70">Select an asset</Text>
        <ScrollView className="md:h-[50vh]" showsVerticalScrollIndicator={false}>
          <View className="gap-2">
            {allTokens.map(token => {
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
                    <Text className="text-sm font-medium opacity-50">
                      {formatNumber(balance, 2)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

export default TokenSelector;
