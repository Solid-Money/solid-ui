import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { Address } from 'viem';
import { fuse } from 'viem/chains';

import { NATIVE_TOKENS } from '@/constants/tokens';
import { VAULTS } from '@/constants/vaults';
import { useAPYsByAsset, useLatestTokenTransfer, useUserTransactions } from '@/hooks/useAnalytics';
import { useDepositCalculations } from '@/hooks/useDepositCalculations';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
import { fetchTokenPriceUsd } from '@/lib/api';
import { ADDRESSES } from '@/lib/config';
import { calculateYield } from '@/lib/financial';
import { SavingMode } from '@/lib/types';

const ACTIVE_VAULTS = VAULTS.filter(v => !('isComingSoon' in v && v.isComingSoon));
const usdcVault = ACTIVE_VAULTS[0];
const fuseVault = ACTIVE_VAULTS[1]; // undefined when only one active vault

export const useTotalSavingsUSD = (): UseQueryResult<number | undefined, Error> => {
  const { user } = useUser();
  const address = user?.safeAddress as Address;
  const { data: userDepositTransactions } = useUserTransactions(address);
  const { data: apys } = useAPYsByAsset();
  const { data: balanceUsdc, isLoading: isLoadingBalanceUsdc } = useVaultBalance(
    address,
    usdcVault,
  );
  const { data: balanceFuse, isLoading: isLoadingBalanceFuse } = useVaultBalance(
    address,
    fuseVault ?? usdcVault,
  );
  const { data: exchangeRateUsdc } = useVaultExchangeRate(usdcVault.name);
  const { data: exchangeRateFuse } = useVaultExchangeRate(fuseVault.name);
  const { data: fusePriceUsd } = useQuery({
    queryKey: ['fusePriceUsd'],
    queryFn: () => fetchTokenPriceUsd(NATIVE_TOKENS[fuse.id]),
    staleTime: 60_000,
  });
  const { data: lastTsUsdc } = useLatestTokenTransfer(address, ADDRESSES.fuse.vault);
  const { data: lastTsFuse } = useLatestTokenTransfer(address, ADDRESSES.fuse.fuseVault);

  const { firstDepositTimestamp: firstDepositUsdc } = useDepositCalculations(
    userDepositTransactions,
    balanceUsdc,
    lastTsUsdc,
    usdcVault.decimals,
  );
  const { firstDepositTimestamp: firstDepositFuse } = useDepositCalculations(
    userDepositTransactions,
    balanceFuse,
    lastTsFuse,
    (fuseVault ?? usdcVault).decimals,
  );

  const apyUsdc = apys?.usdc?.allTime ?? 0;
  const apyFuse = fuseVault ? (apys?.fuse?.allTime ?? 0) : 0;

  const hasAnyBalance = (balanceUsdc ?? 0) > 0 || (balanceFuse ?? 0) > 0;

  return useQuery({
    queryKey: [
      'totalSavingsUSD',
      address,
      balanceUsdc,
      balanceFuse,
      apyUsdc,
      apyFuse,
      firstDepositUsdc,
      firstDepositFuse,
      exchangeRateUsdc,
      exchangeRateFuse,
      fusePriceUsd,
      isLoadingBalanceUsdc,
      isLoadingBalanceFuse,
    ],
    queryFn: async () => {
      const now = Math.floor(Date.now() / 1000);

      const usdUsdc = await calculateYield(
        balanceUsdc ?? 0,
        apyUsdc,
        firstDepositUsdc ?? 0,
        now,
        SavingMode.TOTAL_USD,
        userDepositTransactions,
        address!,
        exchangeRateUsdc ?? 1,
        usdcVault.vaults[0].address,
        usdcVault.decimals,
      );

      // FUSE vault yield is in FUSE (exchangeRateFuse is soFUSE→FUSE); convert to USD for total
      const fuseYieldInFuse = fuseVault
        ? await calculateYield(
            balanceFuse ?? 0,
            apyFuse,
            firstDepositFuse ?? 0,
            now,
            SavingMode.TOTAL_USD,
            userDepositTransactions,
            address!,
            exchangeRateFuse ?? 1,
            fuseVault.vaults[0].address,
            fuseVault.decimals,
          )
        : 0;
      const fusePrice = Number(fusePriceUsd) || 0;
      const usdFuse = fuseYieldInFuse * fusePrice;
      return usdUsdc + usdFuse;
    },
    enabled: !!address,
    staleTime: 30_000,
    refetchInterval: hasAnyBalance ? 60_000 : false,
    refetchIntervalInBackground: false,
  });
};
