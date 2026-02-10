import { useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchExchangeRate, fetchExchangeRatesoFuse } from '@/hooks/usePreviewDeposit';

export const useVaultExchangeRate = (tokenName: string) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['vaultExchangeRate', tokenName],
    queryFn: async () => {
      if (tokenName === 'USDC') {
        const rate = await fetchExchangeRate(queryClient);
        return Number(rate) / 10 ** 6; // Assuming getRate returns 6 decimals
      }

      if (tokenName === 'FUSE') {
        const rate = await fetchExchangeRatesoFuse(queryClient);
        return Number(rate) / 10 ** 18;
      }

      return 1;
    },
    staleTime: 60 * 1000, // 1 minute
  });
};
