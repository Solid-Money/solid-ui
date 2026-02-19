import { useQuery } from '@tanstack/react-query';
import { Address } from 'viem';

import { useAPYs, useLatestTokenTransfer, useUserTransactions } from '@/hooks/useAnalytics';
import { useDepositCalculations } from '@/hooks/useDepositCalculations';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
import { ADDRESSES } from '@/lib/config';
import { calculateYield } from '@/lib/financial';
import { SavingMode, Vault } from '@/lib/types';

/** Total value (balance + interest) in display units for one vault, same source as main savings "Total value". */
export function useVaultTotalValue(vault: Vault) {
  const { user } = useUser();
  const address = user?.safeAddress as Address;

  const { data: balance } = useVaultBalance(address, vault);
  const { data: exchangeRate } = useVaultExchangeRate(vault.name);
  const { data: apys } = useAPYs(vault.type);
  const tokenAddress =
    vault.name === 'USDC' ? ADDRESSES.fuse.vault : vault.vaults?.[0]?.address ?? ADDRESSES.fuse.vault;
  const { data: lastTimestamp } = useLatestTokenTransfer(address ?? '', tokenAddress);
  const { data: userDepositTransactions } = useUserTransactions(address);
  const { firstDepositTimestamp } = useDepositCalculations(
    userDepositTransactions,
    balance,
    lastTimestamp,
    vault.decimals,
  );

  const vaultAPY =
    apys?.allTime != null && Number.isFinite(Number(apys.allTime)) ? Number(apys.allTime) : 0;

  return useQuery({
    queryKey: [
      'vaultTotalValue',
      vault.name,
      address,
      balance,
      exchangeRate,
      vaultAPY,
      firstDepositTimestamp,
      userDepositTransactions,
    ],
    queryFn: async () => {
      const now = Math.floor(Date.now() / 1000);
      return calculateYield(
        balance ?? 0,
        vaultAPY,
        firstDepositTimestamp ?? 0,
        now,
        SavingMode.TOTAL_USD,
        userDepositTransactions,
        address,
        exchangeRate ?? 1,
        vault.vaults?.[0]?.address ?? ADDRESSES.fuse.vault,
        vault.decimals,
      );
    },
    enabled: !!address && balance !== undefined,
    staleTime: 30_000,
  });
}
