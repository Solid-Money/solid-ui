import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { formatUnits } from 'viem';
import { fuse } from 'viem/chains';
import { useShallow } from 'zustand/react/shallow';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Text } from '@/components/ui/text';
import { getBridgeChain } from '@/constants/bridge';
import { SEND_MODAL } from '@/constants/modals';
import { isSameCoin } from '@/hooks/useCoinBreakdown';
import { useCrossChainSendConfig } from '@/hooks/useCrossChainSendConfig';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import getTokenIcon from '@/lib/getTokenIcon';
import { TokenBalance } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import { getCrossChainSendToken, isCrossChainSendToken } from '@/lib/utils/cross-chain-send';
import { getChain } from '@/lib/wagmi';
import { useSendStore } from '@/store/useSendStore';

import ToInput from './ToInput';

const TokenSelector: React.FC = () => {
  // Use useShallow for object selection to prevent unnecessary re-renders
  const {
    selectedToken,
    isCrossChain,
    destinationChainId,
    setSelectedToken,
    setModal,
    setIsCrossChain,
    setDestinationChainId,
    setCrossChainQuote,
  } = useSendStore(
    useShallow(state => ({
      selectedToken: state.selectedToken,
      isCrossChain: state.isCrossChain,
      destinationChainId: state.destinationChainId,
      setSelectedToken: state.setSelectedToken,
      setModal: state.setModal,
      setIsCrossChain: state.setIsCrossChain,
      setDestinationChainId: state.setDestinationChainId,
      setCrossChainQuote: state.setCrossChainQuote,
    })),
  );
  // Opened from the cross-chain amount step: only the two bridgeable Fuse
  // stablecoins apply, and selecting one returns there.
  const { getRoute } = useCrossChainSendConfig({ enabled: isCrossChain });
  const {
    ethereumTokens,
    fuseTokens,
    polygonTokens,
    baseTokens,
    arbitrumTokens,
    bscTokens,
    isLoading,
  } = useWalletTokens();

  // Combine and sort tokens by USD value (descending)
  const allTokens = useMemo(() => {
    const combined = [
      ...ethereumTokens,
      ...fuseTokens,
      ...polygonTokens,
      ...baseTokens,
      ...arbitrumTokens,
      ...bscTokens,
    ];
    // In the bridge flow: the bridgeable Fuse stablecoins, plus the coin being
    // sent on its other chains, which leave the bridge for the regular send.
    const eligible = isCrossChain
      ? combined.filter(
          t =>
            isCrossChainSendToken(t) ||
            (!!selectedToken && t.chainId !== fuse.id && isSameCoin(selectedToken, t)),
        )
      : combined;
    return eligible.sort((a, b) => {
      const balanceA = Number(formatUnits(BigInt(a.balance || '0'), a.contractDecimals));
      const balanceUSD_A = balanceA * (a.quoteRate || 0);

      const balanceB = Number(formatUnits(BigInt(b.balance || '0'), b.contractDecimals));
      const balanceUSD_B = balanceB * (b.quoteRate || 0);

      return balanceUSD_B - balanceUSD_A; // Descending order
    });
  }, [
    ethereumTokens,
    fuseTokens,
    polygonTokens,
    baseTokens,
    arbitrumTokens,
    bscTokens,
    isCrossChain,
    selectedToken,
  ]);

  const handleTokenSelect = useCallback(
    (token: TokenBalance) => {
      setSelectedToken(token);
      if (!isCrossChain) {
        setModal(SEND_MODAL.OPEN_FORM);
        return;
      }
      if (!isCrossChainSendToken(token)) {
        // Not on Fuse, so no bridge: hand over to the regular send on the
        // token's own chain, keeping the recipient address already entered.
        setIsCrossChain(false);
        setDestinationChainId(null);
        setCrossChainQuote(null);
        setModal(SEND_MODAL.OPEN_FORM);
        return;
      }
      // The chosen network may not carry this token (USDT has no Base route):
      // send the user back to pick one that does.
      const hasRoute = !!getRoute(getCrossChainSendToken(token), destinationChainId);
      setModal(hasRoute ? SEND_MODAL.OPEN_CROSS_CHAIN_FORM : SEND_MODAL.OPEN_CROSS_CHAIN_NETWORK);
    },
    [
      setSelectedToken,
      setModal,
      isCrossChain,
      getRoute,
      destinationChainId,
      setIsCrossChain,
      setDestinationChainId,
      setCrossChainQuote,
    ],
  );

  return (
    <View className="gap-8">
      {!isCrossChain ? <ToInput /> : null}

      <View className="gap-4">
        <Text className="text-base font-medium opacity-70">Select an asset</Text>
        <ScrollView className="md:h-[50vh]" showsVerticalScrollIndicator={false}>
          {/* An empty wallet is a normal state here — a cardholder who funds their
              card directly holds a balance with us and nothing in their wallet —
              and an unexplained blank list under "Select an asset" reads as a
              screen that failed to load. */}
          {!isLoading && allTokens.length === 0 ? (
            <View className="gap-1 rounded-2xl bg-card px-4 py-6">
              <Text className="text-base font-semibold">No assets in your wallet yet</Text>
              <Text className="text-sm opacity-50">
                Money held on your card or in savings has to reach your wallet before it can be
                sent. Use Add Funds to top your wallet up.
              </Text>
            </View>
          ) : null}
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
                        {token.contractTickerSymbol} on{' '}
                        {getBridgeChain(token.chainId)?.name ?? getChain(token.chainId)?.name}
                        {isCrossChain && !isCrossChainSendToken(token) ? ' · regular send' : ''}
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
