import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Address } from 'viem';
import { fuse } from 'viem/chains';

import { NATIVE_TOKENS } from '@/constants/tokens';
import { VAULTS } from '@/constants/vaults';
import { useAPYsByAsset, useLatestTokenTransfer, useUserTransactions } from '@/hooks/useAnalytics';
import { useDepositCalculations } from '@/hooks/useDepositCalculations';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
import { ADDRESSES } from '@/lib/config';
import { fetchTokenPriceUsd } from '@/lib/api';
import { calculateYield } from '@/lib/financial';
import { SavingMode } from '@/lib/types';

const ACTIVE_VAULTS = VAULTS.filter(v => !('isComingSoon' in v && v.isComingSoon));

export const useTotalSavingsUSD = () => {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const address = user?.safeAddress as Address | undefined;
  const [currentTime, setCurrentTime] = useState(() => Math.floor(Date.now() / 1000));
  const [totalSavingsUSD, setTotalSavingsUSD] = useState<number | undefined>(undefined);

  const { data: userDepositTransactions } = useUserTransactions(address);
  const { data: apys } = useAPYsByAsset();

  const transactionsRef = useRef(userDepositTransactions);
  const transactionsKey = useMemo(
    () => JSON.stringify(userDepositTransactions ?? null),
    [userDepositTransactions],
  );
  useEffect(() => {
    transactionsRef.current = userDepositTransactions;
  }, [transactionsKey, userDepositTransactions]);

  const usdcVault = ACTIVE_VAULTS[0];
  const fuseVault = ACTIVE_VAULTS[1]; // undefined when only one active vault

  const safeAddress = address ?? ('' as Address);
  const { data: balanceUsdc, isLoading: isLoadingBalanceUsdc } = useVaultBalance(safeAddress, usdcVault);
  const { data: balanceFuse, isLoading: isLoadingBalanceFuse } = useVaultBalance(safeAddress, fuseVault ?? usdcVault);
  const { data: exchangeRateUsdc } = useVaultExchangeRate(usdcVault.name);
  const { data: exchangeRateFuse } = useVaultExchangeRate(fuseVault?.name ?? '');
  const { data: fusePriceUsd } = useQuery({
    queryKey: ['fusePriceUsd'],
    queryFn: () => fetchTokenPriceUsd(NATIVE_TOKENS[fuse.id]),
    staleTime: 60 * 1000,
  });
  const { data: lastTsUsdc } = useLatestTokenTransfer(address ?? '', ADDRESSES.fuse.vault);
  const { data: lastTsFuse } = useLatestTokenTransfer(address ?? '', ADDRESSES.fuse.fuseVault);

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
  useEffect(() => {
    if (!hasAnyBalance) return;
    const interval = setInterval(() => setCurrentTime(Math.floor(Date.now() / 1000)), 30000);
    return () => clearInterval(interval);
  }, [hasAnyBalance]);

  useEffect(() => {
    if (!address) {
      setTotalSavingsUSD(undefined);
      return;
    }
    // Don't compute until vault balances have resolved; otherwise we set 0 on native
    // when the effect runs before React Query has returned (balanceUsdc/Fuse undefined).
    if (isLoadingBalanceUsdc || isLoadingBalanceFuse) {
      setTotalSavingsUSD(undefined);
      return;
    }

    let cancelled = false;
    const run = async () => {
      const now = currentTime || Math.floor(Date.now() / 1000);
      const tx = transactionsRef.current;

      const usdUsdc = await calculateYield(
        balanceUsdc ?? 0,
        apyUsdc,
        firstDepositUsdc ?? 0,
        now,
        SavingMode.TOTAL_USD,
        queryClient,
        tx,
        address,
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
            queryClient,
            tx,
            address,
            exchangeRateFuse ?? 1,
            fuseVault.vaults[0].address,
            fuseVault.decimals,
          )
        : 0;
      const fusePrice = Number(fusePriceUsd) || 0;
      const usdFuse = fuseYieldInFuse * fusePrice;

      if (!cancelled) setTotalSavingsUSD(usdUsdc + usdFuse);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    address,
    balanceUsdc,
    balanceFuse,
    apyUsdc,
    apyFuse,
    firstDepositUsdc,
    firstDepositFuse,
    currentTime,
    exchangeRateUsdc,
    exchangeRateFuse,
    fusePriceUsd,
    queryClient,
    transactionsKey,
    fuseVault,
    usdcVault.decimals,
    usdcVault.vaults,
    isLoadingBalanceUsdc,
    isLoadingBalanceFuse,
  ]);

  const isLoading =
    isLoadingBalanceUsdc ||
    isLoadingBalanceFuse ||
    (firstDepositUsdc === undefined && (balanceUsdc ?? 0) > 0) ||
    (firstDepositFuse === undefined && (balanceFuse ?? 0) > 0);

  return { totalSavingsUSD, isLoading };
};
