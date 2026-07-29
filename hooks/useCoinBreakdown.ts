import { useMemo } from 'react';
import { formatUnits } from 'viem';

import { CHAIN_NAMES } from '@/constants/chains';
import { TokenBalance } from '@/lib/types';
import { getTokenVault, isVaultShareToken } from '@/lib/vaults';
import { getChain } from '@/lib/wagmi';

import { useWalletTokens } from './useWalletTokens';

export enum HeldIn {
  WALLET = 'wallet',
  SAVINGS = 'savings',
}

export type CoinBreakdownItem = {
  chainId: number;
  chainName: string;
  heldIn: HeldIn;
  /** Balance expressed in the displayed symbol's units. */
  balance: number;
  balanceUSD: number;
  percentage: number;
};

export type CoinBreakdown = {
  /** Symbol every amount is denominated in — the underlying asset for vault tokens. */
  symbol: string;
  totalBalance: number;
  totalBalanceUSD: number;
  items: CoinBreakdownItem[];
  /** Only yield-bearing assets (soUSD / soFUSE / soETH) can hold a savings position. */
  hasSavings: boolean;
};

/**
 * Splits a coin's holdings into per-chain wallet and savings rows.
 *
 * For a yield-bearing asset the family spans the underlying token (USDC / FUSE /
 * ETH) and its vault share token, so wallet and savings sit side by side. Share
 * balances are converted to underlying units via USD value, since a share is not
 * worth exactly one unit of the underlying. Every other token only ever groups
 * with itself across chains, where balances are already in matching units.
 */
export const useCoinBreakdown = (token: TokenBalance | undefined): CoinBreakdown | undefined => {
  const { tokens } = useWalletTokens();
  const tokenVault = useMemo(() => getTokenVault(token), [token]);

  return useMemo(() => {
    if (!token) return undefined;

    const family = tokenVault
      ? tokens.filter(t =>
          isVaultShareToken(t.contractAddress)
            ? tokenVault.vault.vaults.some(
                v => v.address.toLowerCase() === t.contractAddress?.toLowerCase(),
              )
            : t.contractTickerSymbol?.toUpperCase() === tokenVault.vault.name.toUpperCase(),
        )
      : token.commonId
        ? tokens.filter(t => t.commonId === token.commonId)
        : tokens.filter(t => t.contractTickerSymbol === token.contractTickerSymbol);

    if (family.length === 0) return undefined;

    // Rate of the underlying, used to restate share balances in underlying units.
    const underlyingRate =
      family.find(t => !isVaultShareToken(t.contractAddress) && t.quoteRate)?.quoteRate ??
      family.find(t => t.quoteRate)?.quoteRate ??
      0;

    const rows = family.map(t => {
      const rawBalance = Number(formatUnits(BigInt(t.balance || '0'), t.contractDecimals));
      const balanceUSD = rawBalance * (t.quoteRate || 0);
      const isShare = isVaultShareToken(t.contractAddress);

      return {
        chainId: t.chainId,
        chainName: CHAIN_NAMES[t.chainId] || getChain(t.chainId)?.name || 'Unknown',
        heldIn: isShare ? HeldIn.SAVINGS : HeldIn.WALLET,
        balance: isShare && underlyingRate > 0 ? balanceUSD / underlyingRate : rawBalance,
        balanceUSD,
        percentage: 0,
      } satisfies CoinBreakdownItem;
    });

    const merged = new Map<string, CoinBreakdownItem>();
    rows.forEach(row => {
      const key = `${row.chainId}-${row.heldIn}`;
      const existing = merged.get(key);

      if (existing) {
        existing.balance += row.balance;
        existing.balanceUSD += row.balanceUSD;
      } else {
        merged.set(key, { ...row });
      }
    });

    const items = Array.from(merged.values()).sort((a, b) => {
      if (a.chainId !== b.chainId) return a.chainId - b.chainId;
      return a.heldIn === HeldIn.WALLET ? -1 : 1;
    });

    const totalBalanceUSD = items.reduce((sum, item) => sum + item.balanceUSD, 0);
    items.forEach(item => {
      item.percentage = totalBalanceUSD > 0 ? (item.balanceUSD / totalBalanceUSD) * 100 : 0;
    });

    return {
      symbol: tokenVault?.vault.name ?? token.contractTickerSymbol,
      totalBalance: items.reduce((sum, item) => sum + item.balance, 0),
      totalBalanceUSD,
      items,
      hasSavings: items.some(item => item.heldIn === HeldIn.SAVINGS),
    };
  }, [token, tokenVault, tokens]);
};
