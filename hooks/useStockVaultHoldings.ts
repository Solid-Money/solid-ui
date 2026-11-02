import { useQuery } from '@tanstack/react-query';
import { secondsToMilliseconds } from 'date-fns';
import { Address } from 'viem';

import useUser from '@/hooks/useUser';
import { VAULT } from '@/hooks/useVault';
import { fetchStockVaultHoldings } from '@/lib/stockVaults';

/**
 * Every stock vault position in the Solid wallet, keyed by vault type: shares, the
 * stock tokens they redeem for, and their USD value (see `lib/stockVaults`).
 *
 * One multicall for all eight vaults rather than a read per vault, and polled less
 * often than the other vaults: a stock position only changes on a deposit or
 * withdrawal, and those refetch every `vault` query when they land.
 */
export const useStockVaultHoldings = () => {
  const { user } = useUser();
  const safeAddress = user?.safeAddress as Address | undefined;

  return useQuery({
    queryKey: [VAULT, 'stockHoldings', safeAddress],
    queryFn: () => fetchStockVaultHoldings(safeAddress!),
    enabled: !!safeAddress,
    staleTime: secondsToMilliseconds(15),
    gcTime: secondsToMilliseconds(300),
    refetchInterval: secondsToMilliseconds(30),
  });
};
