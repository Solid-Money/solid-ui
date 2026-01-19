import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { formatUnits } from 'viem';
import { fuse } from 'viem/chains';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Text } from '@/components/ui/text';
import { USDC_STARGATE } from '@/constants/addresses';
import { getBridgeChain } from '@/constants/bridge';
import { CARD_REPAY_MODAL } from '@/constants/modals';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import getTokenIcon from '@/lib/getTokenIcon';
import { TokenBalance, TokenType } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import { useCardRepayStore } from '@/store/useCardRepayStore';

// Default USDC token on Fuse (shown even if balance is 0)
const DEFAULT_USDC_TOKEN: TokenBalance = {
  contractTickerSymbol: 'USDC',
  contractName: 'USD Coin',
  contractAddress: USDC_STARGATE,
  balance: '0',
  quoteRate: 1,
  contractDecimals: 6,
  type: TokenType.ERC20,
  chainId: fuse.id,
};

const CardRepayTokenSelector: React.FC = () => {
  const { selectedToken, setSelectedToken, setModal } = useCardRepayStore();
  const { fuseTokens } = useWalletTokens();

  // Filter for USDC tokens on Fuse chain only, and ensure default USDC is always included
  const usdcTokens = useMemo(() => {
    const filtered = fuseTokens.filter(
      token =>
        (token.contractTickerSymbol?.toLowerCase() === 'usdc' ||
          token.contractTickerSymbol?.toLowerCase() === 'usdc.e') &&
        token.chainId === fuse.id,
    );

    // Check if default USDC is already in the list
    const hasDefaultUsdc = filtered.some(
      token => token.contractAddress.toLowerCase() === USDC_STARGATE.toLowerCase(),
    );

    // If not found, add the default USDC token
    if (!hasDefaultUsdc) {
      return [DEFAULT_USDC_TOKEN, ...filtered];
    }

    return filtered;
  }, [fuseTokens]);

  // Sort tokens by USD value (descending)
  const sortedTokens = useMemo(() => {
    return usdcTokens.sort((a, b) => {
      const balanceA = Number(formatUnits(BigInt(a.balance || '0'), a.contractDecimals));
      const balanceUSD_A = balanceA * (a.quoteRate || 0);

      const balanceB = Number(formatUnits(BigInt(b.balance || '0'), b.contractDecimals));
      const balanceUSD_B = balanceB * (b.quoteRate || 0);

      return balanceUSD_B - balanceUSD_A; // Descending order
    });
  }, [usdcTokens]);

  const handleTokenSelect = (token: TokenBalance) => {
    setSelectedToken(token);
    setModal(CARD_REPAY_MODAL.OPEN_FORM);
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

export default CardRepayTokenSelector;
