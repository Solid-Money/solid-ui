import { useMemo } from 'react';
import { formatUnits } from 'viem';

import { getVaultKey, VAULT_META, VaultKey, VaultMeta } from '@/constants/withdraw';
import { TokenBalance } from '@/lib/types';
import { type VaultCurrency } from '@/lib/vaultCurrency';

import { useVaultExchangeRate } from './useVaultExchangeRate';
import { useWalletTokens } from './useWalletTokens';

export interface SavingsVault {
  key: VaultKey;
  meta: VaultMeta;
  /** All held tokens belonging to this vault, across every network. */
  tokens: TokenBalance[];
  /**
   * Aggregate USD value of the held tokens in this vault. Always 0 for soEURC,
   * which is never converted to dollars — read `balance` for it instead.
   */
  balanceUSD: number;
  /** Aggregate value of the held tokens in `currency`: USD, or EUR for soEURC. */
  balance: number;
  currency: VaultCurrency;
}

const tokenBalance = (token: TokenBalance) =>
  Number(formatUnits(BigInt(token.balance || '0'), token.contractDecimals));

/**
 * Groups the user's withdrawable vault tokens by their underlying asset
 * (soUSD / soFUSE / soETH / soEURC), independent of the network they sit on.
 * Used by the withdraw flow to decide whether to show the vault selection screen
 * and to build the per-vault network dropdown.
 *
 * soEURC is grouped for whoever holds it, in every build, so a position can always be
 * withdrawn. It is valued in EUR from its accountant rate: its wallet token carries no
 * USD quote.
 */
export const useSavingsVaults = () => {
  const { ethereumTokens, fuseTokens, baseTokens, arbitrumTokens, isLoading } = useWalletTokens();
  const hasEurTokens = baseTokens.some(token => getVaultKey(token.contractTickerSymbol) === 'EUR');
  const { data: eurRate, isLoading: isEurRateLoading } = useVaultExchangeRate('EUR', hasEurTokens);

  const vaults = useMemo<SavingsVault[]>(() => {
    const allTokens = [...ethereumTokens, ...fuseTokens, ...baseTokens, ...arbitrumTokens];
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
      .map(([key, tokens]): SavingsVault => {
        if (key === 'EUR') {
          // Shares × the soEURC→EURC rate (1:1 until it loads), EURC read at par.
          const shares = tokens.reduce((sum, t) => sum + tokenBalance(t), 0);
          return {
            key,
            meta: VAULT_META[key],
            tokens,
            balanceUSD: 0,
            balance: shares * (eurRate ?? 1),
            currency: 'EUR',
          };
        }
        const balanceUSD = tokens.reduce((sum, t) => sum + tokenBalance(t) * (t.quoteRate || 0), 0);
        return {
          key,
          meta: VAULT_META[key],
          tokens,
          balanceUSD,
          balance: balanceUSD,
          currency: 'USD',
        };
      })
      .sort((a, b) => b.balanceUSD - a.balanceUSD);
  }, [ethereumTokens, fuseTokens, baseTokens, arbitrumTokens, eurRate]);

  return { vaults, isLoading: isLoading || (hasEurTokens && isEurRateLoading) };
};

export default useSavingsVaults;
