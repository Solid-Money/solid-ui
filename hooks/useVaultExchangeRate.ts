import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchExchangeRate,
  fetchExchangeRateSoEth,
  fetchExchangeRateSoEurc,
  fetchExchangeRatesoFuse,
} from '@/hooks/usePreviewDeposit';

/**
 * The share → underlying rate for a vault, by vault name, in display units:
 * soUSD→USD for USDC, soFUSE→FUSE for FUSE, soETH→ETH for ETH and soEURC→EURC
 * for EUR (shown in euros, never converted to dollars).
 *
 * An unknown name is an error rather than a 1:1 rate: a guessed 1 would value
 * another vault's shares at par without anyone noticing.
 */
export const useVaultExchangeRate = (tokenName: string, enabled = true) => {
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

      if (tokenName === 'EUR') {
        const rate = await fetchExchangeRateSoEurc(queryClient);
        return Number(rate) / 10 ** 6; // soEURC → EURC (6 decimals), shown in EUR
      }

      throw new Error(`No exchange rate source for vault "${tokenName}"`);
    },
    enabled,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
};
