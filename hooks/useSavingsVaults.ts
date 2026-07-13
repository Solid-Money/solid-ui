import { useMemo } from 'react';
import { formatUnits } from 'viem';

import { getVaultKey, VAULT_META, VaultKey, VaultMeta } from '@/constants/withdraw';
import { TokenBalance } from '@/lib/types';

import { useWalletTokens } from './useWalletTokens';

export interface SavingsVault {
  key: VaultKey;
  meta: VaultMeta;
  /** All held tokens belonging to this vault, across every network. */
  tokens: TokenBalance[];
  /** Aggregate USD value of the held tokens in this vault. */
  balanceUSD: number;
}

const tokenBalance = (token: TokenBalance) =>
  Number(formatUnits(BigInt(token.balance || '0'), token.contractDecimals));

/**
 * Groups the user's withdrawable vault tokens by their underlying asset
 * (soUSD / soFUSE / soETH), independent of the network they sit on. Used by
 * the withdraw flow to decide whether to show the vault selection screen and
 * to build the per-vault network dropdown.
 */
export const useSavingsVaults = () => {
  const { ethereumTokens, fuseTokens, baseTokens, isLoading } = useWalletTokens();

  const vaults = useMemo<SavingsVault[]>(() => {
    const allTokens = [...ethereumTokens, ...fuseTokens, ...baseTokens];
    const grouped = new Map<VaultKey, TokenBalance[]>();

    for (const token of allTokens) {
      const key = getVaultKey(token.contractTickerSymbol);
      if (!key) continue;
      if (tokenBalance(token) <= 0) continue;
      const existing = grouped.get(key);
      if (existing) existing.push(token);
      else grouped.set(key, [token]);
    }

    return Array.from(grouped.entries())
      .map(([key, tokens]) => ({
        key,
        meta: VAULT_META[key],
        tokens,
        balanceUSD: tokens.reduce((sum, t) => sum + tokenBalance(t) * (t.quoteRate || 0), 0),
      }))
      .sort((a, b) => b.balanceUSD - a.balanceUSD);
  }, [ethereumTokens, fuseTokens, baseTokens]);

  return { vaults, isLoading };
};

export default useSavingsVaults;
