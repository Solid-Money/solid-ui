import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { formatUnits } from 'viem';
import { useShallow } from 'zustand/react/shallow';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS, getBridgeChain } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { VAULTS } from '@/constants/vaults';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import getTokenIcon from '@/lib/getTokenIcon';
import { TokenBalance } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';
import { useSavingStore } from '@/store/useSavingStore';

/**
 * Token selector for the Savings deposit flow (Step 2).
 * Shows tokens from the user's Solid wallet that can be deposited into vaults,
 * with chain names displayed. Selecting a token sets the srcChainId, outputToken,
 * and appropriate vault, then navigates to the deposit form.
 */
const SavingsDepositTokenSelector: React.FC = () => {
  const { setSrcChainId, setOutputToken, setModal } = useDepositStore(
    useShallow(state => ({
      setSrcChainId: state.setSrcChainId,
      setOutputToken: state.setOutputToken,
      setModal: state.setModal,
    })),
  );
  const { selectVaultForDeposit } = useSavingStore();
  const { ethereumTokens, fuseTokens, baseTokens, arbitrumTokens } = useWalletTokens();

  // Build a list of depositable tokens that match vault supported tokens
  const depositableTokens = useMemo(() => {
    const allTokens = [...ethereumTokens, ...fuseTokens, ...baseTokens, ...arbitrumTokens];

    // Collect all supported token symbols per chain from vault configs
    const supportedSet = new Set<string>();
    for (const vault of VAULTS) {
      const config = vault.depositConfig;
      if (!config) continue;
      for (const chainId of config.supportedChains) {
        for (const symbol of config.supportedTokens) {
          supportedSet.add(`${chainId}:${symbol.toUpperCase()}`);
        }
      }
    }

    return allTokens.filter(token => {
      const symbol = token.contractTickerSymbol?.toUpperCase();
      const key = `${token.chainId}:${symbol}`;
      if (!supportedSet.has(key)) return false;
      // Only show tokens with a non-zero balance
      const balance = Number(formatUnits(BigInt(token.balance || '0'), token.contractDecimals));
      return balance > 0;
    });
  }, [ethereumTokens, fuseTokens, baseTokens, arbitrumTokens]);

  // Sort by USD value descending
  const sortedTokens = useMemo(() => {
    return [...depositableTokens].sort((a, b) => {
      const balanceA = Number(formatUnits(BigInt(a.balance || '0'), a.contractDecimals));
      const balanceUSD_A = balanceA * (a.quoteRate || 0);
      const balanceB = Number(formatUnits(BigInt(b.balance || '0'), b.contractDecimals));
      const balanceUSD_B = balanceB * (b.quoteRate || 0);
      return balanceUSD_B - balanceUSD_A;
    });
  }, [depositableTokens]);

  const handleTokenSelect = useCallback(
    (token: TokenBalance) => {
      const symbol = token.contractTickerSymbol?.toUpperCase();
      const chainId = token.chainId;

      // Find the matching vault for this token
      const vaultIndex = VAULTS.findIndex(v =>
        v.depositConfig?.supportedTokens.some(s => s.toUpperCase() === symbol) &&
        v.depositConfig?.supportedChains.includes(chainId),
      );
      if (vaultIndex !== -1) {
        selectVaultForDeposit(vaultIndex);
      }

      // Look up the token key in BRIDGE_TOKENS for this chain
      const bridgeTokens = BRIDGE_TOKENS[chainId]?.tokens;
      const tokenKey = bridgeTokens
        ? Object.keys(bridgeTokens).find(k => k.toUpperCase() === symbol)
        : undefined;

      setSrcChainId(chainId);
      setOutputToken(tokenKey || symbol);
      setModal(DEPOSIT_MODAL.OPEN_FORM);
    },
    [setSrcChainId, setOutputToken, setModal, selectVaultForDeposit],
  );

  if (sortedTokens.length === 0) {
    return (
      <View className="items-center justify-center gap-4 py-12">
        <Text className="text-lg font-medium text-muted-foreground">
          No depositable tokens found
        </Text>
        <Text className="text-center text-sm text-muted-foreground">
          Add funds to your wallet first, then come back to deposit into Savings.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <Text className="text-base font-medium opacity-70">
        Select a token from your wallet to deposit
      </Text>
      <ScrollView className="md:h-[50vh]" showsVerticalScrollIndicator={false}>
        <View className="gap-2">
          {sortedTokens.map(token => {
            const balance = Number(
              formatUnits(BigInt(token.balance || '0'), token.contractDecimals),
            );
            const balanceUSD = balance * (token.quoteRate || 0);
            const chainName = getBridgeChain(token.chainId)?.name || `Chain ${token.chainId}`;

            return (
              <Pressable
                key={`${token.contractAddress}-${token.chainId}`}
                className="flex-row items-center justify-between rounded-2xl bg-card px-4 py-4 web:hover:bg-accent/50"
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
    </View>
  );
};

export default SavingsDepositTokenSelector;
