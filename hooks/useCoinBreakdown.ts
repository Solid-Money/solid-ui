import { useMemo } from 'react';
import { formatUnits } from 'viem';

import { CHAIN_NAMES } from '@/constants/chains';
import { TokenBalance } from '@/lib/types';
import { isVaultShareToken } from '@/lib/vaults';
import { getChain } from '@/lib/wagmi';

import { useWalletTokens } from './useWalletTokens';

export type CoinBreakdownItem = {
  chainId: number;
  chainName: string;
  balance: number;
  balanceUSD: number;
  percentage: number;
};

export type CoinBreakdown = {
  /** Symbol every amount is denominated in — the coin's own ticker. */
  symbol: string;
  totalBalance: number;
  totalBalanceUSD: number;
  items: CoinBreakdownItem[];
};

/**
 * Splits a coin's holdings into per-chain rows.
 *
 * A coin only ever groups with itself across chains — a vault share token
 * (soUSD / soFUSE / soETH) is its own coin, kept apart from the underlying
 * asset it was minted from, so a USDC page never counts soUSD and vice versa.
 */
export const useCoinBreakdown = (token: TokenBalance | undefined): CoinBreakdown | undefined => {
  const { tokens } = useWalletTokens();

  return useMemo(() => {
    if (!token) return undefined;

    const isShare = isVaultShareToken(token.contractAddress);
    const family = tokens.filter(t => {
      if (isVaultShareToken(t.contractAddress) !== isShare) return false;

      return token.commonId
        ? t.commonId === token.commonId
        : t.contractTickerSymbol === token.contractTickerSymbol;
    });

    if (family.length === 0) return undefined;

    const rows = family.map(t => {
      const balance = Number(formatUnits(BigInt(t.balance || '0'), t.contractDecimals));

      return {
        chainId: t.chainId,
        chainName: CHAIN_NAMES[t.chainId] || getChain(t.chainId)?.name || 'Unknown',
        balance,
        balanceUSD: balance * (t.quoteRate || 0),
        percentage: 0,
      } satisfies CoinBreakdownItem;
    });

    const merged = new Map<number, CoinBreakdownItem>();
    rows.forEach(row => {
      const existing = merged.get(row.chainId);

      if (existing) {
        existing.balance += row.balance;
        existing.balanceUSD += row.balanceUSD;
      } else {
        merged.set(row.chainId, { ...row });
      }
    });

    const items = Array.from(merged.values()).sort((a, b) => a.chainId - b.chainId);

    const totalBalanceUSD = items.reduce((sum, item) => sum + item.balanceUSD, 0);
    items.forEach(item => {
      item.percentage = totalBalanceUSD > 0 ? (item.balanceUSD / totalBalanceUSD) * 100 : 0;
    });

    return {
      symbol: token.contractTickerSymbol,
      totalBalance: items.reduce((sum, item) => sum + item.balance, 0),
      totalBalanceUSD,
      items,
    };
  }, [token, tokens]);
};
