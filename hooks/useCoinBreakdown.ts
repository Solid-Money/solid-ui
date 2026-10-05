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
 * Whether two balances are the same coin on (possibly) different chains — the
 * grouping a coin page uses. A vault share token is its own coin, never the
 * underlying it was minted from.
 */
export const isSameCoin = (a: TokenBalance, b: TokenBalance): boolean => {
  if (isVaultShareToken(a.contractAddress) !== isVaultShareToken(b.contractAddress)) return false;
  return a.commonId ? b.commonId === a.commonId : b.contractTickerSymbol === a.contractTickerSymbol;
};

/** Every wallet balance of this coin, one per chain it is held on. */
export const useCoinFamily = (token: TokenBalance | undefined): TokenBalance[] => {
  const { tokens } = useWalletTokens();
  return useMemo(() => (token ? tokens.filter(t => isSameCoin(token, t)) : []), [token, tokens]);
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

    const family = tokens.filter(t => isSameCoin(token, t));

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
