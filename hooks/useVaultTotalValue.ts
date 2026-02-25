import { useQuery } from '@tanstack/react-query';
import { Address } from 'viem';

import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
import { Vault } from '@/lib/types';

/** Redeemable amount (balance x rate) for one vault. Matches Total value and withdraw amount. */
export function useVaultTotalValue(vault: Vault) {
  const { user } = useUser();
  const address = user?.safeAddress as Address;

  const { data: balance } = useVaultBalance(address, vault);
  const { data: exchangeRate } = useVaultExchangeRate(vault.name);

  return useQuery({
    queryKey: ['vaultTotalValue', vault.name, address, balance, exchangeRate],
    queryFn: () => {
      const rate = exchangeRate ?? 1;
      const value = (balance ?? 0) * rate;
      return Promise.resolve(value);
    },
    enabled: !!address && balance !== undefined,
    staleTime: 30_000,
  });
}
