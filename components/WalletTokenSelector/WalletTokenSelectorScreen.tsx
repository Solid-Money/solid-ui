import React, { useMemo } from 'react';
import { View } from 'react-native';
import { formatUnits } from 'viem';

import { Text } from '@/components/ui/text';
import { WalletTokenList } from '@/components/WalletTokenSelector';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { TokenBalance } from '@/lib/types';

export interface WalletTokenSelectorScreenProps {
  /** Heading shown above the list. Defaults to "Select a token from your wallet to deposit". */
  title?: string;
  /** Whitelist of chain IDs to show tokens from. */
  supportedChainIds: number[];
  /** Whitelist of token symbols (case-insensitive). */
  supportedTokenSymbols: string[];
  /** Called with the selected token. */
  onSelect: (token: TokenBalance) => void;
  /** Empty-state title. */
  emptyMessage?: string;
  /** Empty-state description. */
  emptyDescription?: string;
  /** When true, include tokens with zero balance. Default: false. */
  includeZeroBalance?: boolean;
}

/**
 * Generic Solid-wallet token picker. Aggregates tokens across all chains the
 * wallet hook exposes, filters by chain + symbol, sorts via WalletTokenList,
 * and invokes onSelect when the user taps a row. Used by both the Savings
 * deposit flow and the Card deposit flow (via thin wrappers that pass the
 * vault- or card-specific filter + navigation callback).
 */
const WalletTokenSelectorScreen: React.FC<WalletTokenSelectorScreenProps> = ({
  title = 'Select a token from your wallet to deposit',
  supportedChainIds,
  supportedTokenSymbols,
  onSelect,
  emptyMessage,
  emptyDescription,
  includeZeroBalance = false,
}) => {
  const { ethereumTokens, fuseTokens, polygonTokens, baseTokens, arbitrumTokens } =
    useWalletTokens();

  const depositableTokens = useMemo(() => {
    const allTokens = [
      ...ethereumTokens,
      ...fuseTokens,
      ...polygonTokens,
      ...baseTokens,
      ...arbitrumTokens,
    ];
    const chainSet = new Set(supportedChainIds);
    const symbolSet = new Set(
      supportedTokenSymbols.map(symbol => symbol.toUpperCase()),
    );

    return allTokens.filter(token => {
      const symbol = token.contractTickerSymbol?.toUpperCase();
      if (!symbol || !symbolSet.has(symbol)) return false;
      if (!chainSet.has(token.chainId)) return false;
      if (includeZeroBalance) return true;
      const balance = Number(
        formatUnits(BigInt(token.balance || '0'), token.contractDecimals),
      );
      return balance > 0;
    });
  }, [
    ethereumTokens,
    fuseTokens,
    polygonTokens,
    baseTokens,
    arbitrumTokens,
    supportedChainIds,
    supportedTokenSymbols,
    includeZeroBalance,
  ]);

  return (
    <View className="gap-4">
      <Text className="text-base font-medium opacity-70">{title}</Text>
      <WalletTokenList
        tokens={depositableTokens}
        onSelect={onSelect}
        emptyMessage={emptyMessage}
        emptyDescription={emptyDescription}
      />
    </View>
  );
};

export default WalletTokenSelectorScreen;
