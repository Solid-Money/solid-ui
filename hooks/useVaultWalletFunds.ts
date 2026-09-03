import { useMemo } from 'react';

import { useBalances } from '@/hooks/useBalances';
import { Vault } from '@/lib/types';
import { hasDepositableWalletBalance } from '@/lib/vaults';

/**
 * Whether the user's Solid wallet holds anything a vault's "Move from wallet"
 * form could actually deposit.
 *
 * `isLoading` is the caller's cue to hold that row back rather than show it and
 * take it away: balances start empty on first load.
 */
export const useVaultWalletFunds = (vault?: Vault) => {
  const { tokens, isLoading } = useBalances();

  const hasFunds = useMemo(() => hasDepositableWalletBalance(tokens, vault), [tokens, vault]);

  return { hasFunds, isLoading };
};

export default useVaultWalletFunds;
