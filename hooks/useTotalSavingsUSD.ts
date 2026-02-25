import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { Address } from 'viem';
import { fuse } from 'viem/chains';

import { NATIVE_TOKENS } from '@/constants/tokens';
import { VAULTS } from '@/constants/vaults';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
import { fetchTokenPriceUsd } from '@/lib/api';

const ACTIVE_VAULTS = VAULTS.filter(v => !('isComingSoon' in v && v.isComingSoon));
const usdcVault = ACTIVE_VAULTS[0];
const fuseVault = ACTIVE_VAULTS[1];

export const useTotalSavingsUSD = (): UseQueryResult<number | undefined, Error> => {
  const { user } = useUser();
  const address = user?.safeAddress as Address;
  const { data: balanceUsdc, isLoading: isLoadingBalanceUsdc } = useVaultBalance(
    address,
    usdcVault,
  );
  const { data: balanceFuse, isLoading: isLoadingBalanceFuse } = useVaultBalance(
    address,
    fuseVault ?? usdcVault,
  );
  const { data: exchangeRateUsdc } = useVaultExchangeRate(usdcVault.name);
  const { data: exchangeRateFuse } = useVaultExchangeRate(fuseVault?.name ?? usdcVault.name);
  const { data: fusePriceUsd } = useQuery({
    queryKey: ['fusePriceUsd'],
    queryFn: () => fetchTokenPriceUsd(NATIVE_TOKENS[fuse.id]),
    staleTime: 60_000,
  });

  const hasAnyBalance = (balanceUsdc ?? 0) > 0 || (balanceFuse ?? 0) > 0;

  return useQuery({
    queryKey: [
      'totalSavingsUSD',
      address,
      balanceUsdc,
      balanceFuse,
      exchangeRateUsdc,
      exchangeRateFuse,
      fusePriceUsd,
      isLoadingBalanceUsdc,
      isLoadingBalanceFuse,
    ],
    queryFn: async () => {
      const rateUsdc = exchangeRateUsdc ?? 1;
      const rateFuse = exchangeRateFuse ?? 1;
      const fusePrice = Number(fusePriceUsd) || 0;
      const redeemableUsdc = (balanceUsdc ?? 0) * rateUsdc;
      const redeemableFuse = fuseVault ? (balanceFuse ?? 0) * rateFuse * fusePrice : 0;
      const total = redeemableUsdc + redeemableFuse;
      return Promise.resolve(total);
    },
    enabled: !!address,
    staleTime: 30_000,
    refetchInterval: hasAnyBalance ? 60_000 : false,
    refetchIntervalInBackground: false,
  });
};
