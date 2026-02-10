import { useQuery, useQueryClient } from '@tanstack/react-query';

import { NATIVE_TOKENS } from '@/constants/tokens';
import { fetchExchangeRate, fetchExchangeRatesoFuse } from '@/hooks/usePreviewDeposit';
import { fetchTokenPriceUsd } from '@/lib/api';
import { fuse } from 'viem/chains';

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
        // Accountant getRate returns soFUSE → underlying FUSE (18 decimals)
        // Multiply by FUSE USD price so consumers get soFUSE → USD.
        const [rate, fusePrice] = await Promise.all([
          fetchExchangeRatesoFuse(queryClient),
          fetchTokenPriceUsd(NATIVE_TOKENS[fuse.id]),
        ]);
        const soFuseToFuse = Number(rate) / 10 ** 18;
        const fusePriceUsd = Number(fusePrice) || 0;
        return soFuseToFuse * fusePriceUsd;
      }

      return 1;
    },
    staleTime: 60 * 1000, // 1 minute
  });
};
