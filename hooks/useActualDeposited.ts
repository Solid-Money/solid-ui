import { useQuery } from '@tanstack/react-query';

import { GetUserTransactionsQuery } from '@/graphql/generated/user-info';
import { calculateActualDepositedAmount } from '@/lib/financial';
import { Vault } from '@/lib/types';

interface UseActualDepositedParams {
  vault: Vault;
  safeAddress?: string;
  balance?: number;
  exchangeRate?: number;
  userDepositTransactions?: GetUserTransactionsQuery;
  enabled?: boolean;
}

/**
 * Net amount the user has deposited into a vault, in the vault's display unit
 * (USD for soUSD, FUSE for soFUSE, ETH for soETH) — i.e. the same unit as
 * `balance x exchangeRate`.
 *
 * This is the deposit-history figure the interest calculation subtracts from the
 * redeemable value (see `calculateYield`), so reading it directly keeps
 * "Deposited" and "Interest earned" consistent instead of deriving one from the
 * other. Returns 0 when the history is unavailable (callers fall back to
 * redeemable - interest).
 */
export const useActualDeposited = ({
  vault,
  safeAddress,
  balance,
  exchangeRate,
  userDepositTransactions,
  enabled = true,
}: UseActualDepositedParams) => {
  const deposits = userDepositTransactions?.deposits;
  const withdraws = userDepositTransactions?.withdraws;
  // The rate ticks on every poll; bucket it so we don't refetch the whole
  // deposit history for an insignificant change.
  const rateBucket = exchangeRate ? Math.round(exchangeRate * 1e4) : 0;

  const { data } = useQuery({
    queryKey: [
      'actual-deposited',
      safeAddress?.toLowerCase(),
      vault.name,
      deposits?.length ?? 0,
      withdraws?.length ?? 0,
      rateBucket,
    ],
    queryFn: async () => {
      if (!safeAddress || !deposits || !withdraws) return 0;

      const { actualDeposited } = await calculateActualDepositedAmount(
        deposits,
        withdraws,
        safeAddress,
        balance ?? 0,
        exchangeRate ?? 1,
        vault.vaults[0].address,
        vault.decimals,
      );

      return actualDeposited > 0 ? actualDeposited : 0;
    },
    enabled: enabled && !!safeAddress && !!deposits && !!withdraws && (balance ?? 0) > 0,
    staleTime: 60_000,
  });

  return data ?? 0;
};
