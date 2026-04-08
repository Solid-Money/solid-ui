import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchExchangeRate,
  fetchExchangeRateSoEth,
  fetchExchangeRatesoFuse,
} from '@/hooks/usePreviewDeposit';

/** Returns soUSD→USD for USDC, soFUSE→FUSE for FUSE (display units on savings page). */
export const useVaultExchangeRate = (tokenName: string) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['vaultExchangeRate', tokenName],
    queryFn: async () => {
      if (tokenName === 'USDC') {
        const rate = await fetchExchangeRate(queryClient);
        return Number(rate) / 10 ** 6; // soUSD → USD (6 decimals)
      }

      if (tokenName === 'FUSE') {
        const rate = await fetchExchangeRatesoFuse(queryClient);
        return Number(rate) / 10 ** 18; // soFUSE → FUSE (18 decimals), for display in FUSE
      }

      if (tokenName === 'ETH') {
        const rate = await fetchExchangeRateSoEth(queryClient);
        return Number(rate) / 10 ** 18; // soETH → ETH (18 decimals)
      }

      return 1;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
};
