import { useMemo } from 'react';
import { Address } from 'viem';
import { fuse, mainnet } from 'viem/chains';

import { VAULTS } from '@/constants/vaults';
import { useNativePriceQuery } from '@/hooks/useNativePriceUsd';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
import { savingsUsdValue } from '@/lib/portfolio';
import { VaultType } from '@/lib/types';

import type { UsdVaultType } from '@/lib/vaultCurrency';

// Looked up by type, never by position: VAULTS gains entries per build (soEURC is
// listed on QA/preview only), so an index would silently point at another vault.
const liveVault = (type: VaultType) =>
  VAULTS.find(vault => vault.type === type && !vault.isComingSoon);
const usdcVault = liveVault(VaultType.USDC) ?? VAULTS[0];
const fuseVault = liveVault(VaultType.FUSE);
const ethVault = liveVault(VaultType.ETH);
const eurVault = liveVault(VaultType.EUR);

/**
 * Total redeemable savings in USD across the USD-valued vaults: soUSD + soFUSE +
 * soETH. USDC uses its soUSD→USD rate directly; FUSE and ETH multiply their
 * soToken→native rate by the native token's USD price.
 *
 * soEURC is deliberately NOT in any of the USD figures — it is held and shown in
 * EUR, and converting it would need a live rate that can fail or go stale (see
 * `lib/vaultCurrency.ts`). It is reported on its own, in EUR, as `eurValue`, with
 * its own loading and error flags so a slow Base read never holds the USD totals.
 */
type SavingsValuesByVault = Record<UsdVaultType, number>;
export type ExactSavingsValuesByVault = Record<UsdVaultType, number | undefined>;

export const useTotalSavingsUSD = (): {
  data: number | undefined;
  valuesByVault: SavingsValuesByVault | undefined;
  exactValuesByVault: ExactSavingsValuesByVault | undefined;
  /** soEURC redeemable value in EUR; 0 when this build lists no EUR vault. */
  eurValue: number | undefined;
  isEurLoading: boolean;
  isEurError: boolean;
  isLoading: boolean;
  isError: boolean;
} => {
  const { user } = useUser();
  const address = user?.safeAddress as Address;

  const {
    data: balanceUsdc,
    isLoading: isLoadingBalanceUsdc,
    isError: isErrorBalanceUsdc,
  } = useVaultBalance(address, usdcVault);
  const {
    data: balanceFuse,
    isLoading: isLoadingBalanceFuse,
    isError: isErrorBalanceFuse,
  } = useVaultBalance(address, fuseVault ?? usdcVault);
  const {
    data: balanceEth,
    isLoading: isLoadingBalanceEth,
    isError: isErrorBalanceEth,
  } = useVaultBalance(address, ethVault ?? usdcVault);
  const {
    data: balanceEur,
    isLoading: isLoadingBalanceEur,
    isError: isErrorBalanceEur,
  } = useVaultBalance(address, eurVault ?? usdcVault);

  const {
    data: exchangeRateUsdc,
    isLoading: isLoadingRateUsdc,
    isError: isErrorRateUsdc,
  } = useVaultExchangeRate(usdcVault.name);
  const {
    data: exchangeRateFuse,
    isLoading: isLoadingRateFuse,
    isError: isErrorRateFuse,
  } = useVaultExchangeRate(fuseVault?.name ?? usdcVault.name);
  const {
    data: exchangeRateEth,
    isLoading: isLoadingRateEth,
    isError: isErrorRateEth,
  } = useVaultExchangeRate(ethVault?.name ?? usdcVault.name);
  const {
    data: exchangeRateEur,
    isLoading: isLoadingRateEur,
    isError: isErrorRateEur,
  } = useVaultExchangeRate(eurVault?.name ?? usdcVault.name);

  const hasFuseBalance = !!fuseVault && (balanceFuse ?? 0) > 0;
  const hasEthBalance = !!ethVault && (balanceEth ?? 0) > 0;
  const hasEurBalance = !!eurVault && (balanceEur ?? 0) > 0;

  const {
    data: fusePriceUsd,
    isLoading: isLoadingFusePrice,
    isError: isErrorFusePrice,
  } = useNativePriceQuery(fuse.id, 'fusePriceUsd', hasFuseBalance);
  const {
    data: ethPriceUsd,
    isLoading: isLoadingEthPrice,
    isError: isErrorEthPrice,
  } = useNativePriceQuery(mainnet.id, 'ethPriceUsd', hasEthBalance);

  const isLoading =
    isLoadingBalanceUsdc ||
    isLoadingBalanceFuse ||
    isLoadingBalanceEth ||
    isLoadingRateUsdc ||
    (hasFuseBalance && (isLoadingRateFuse || isLoadingFusePrice)) ||
    (hasEthBalance && (isLoadingRateEth || isLoadingEthPrice));

  // Lenient, as before: Savings, Earn and the savings card treat `undefined` as "still loading",
  // so a missing price must not hold them on a skeleton. A missing rate reads as 1:1 and a
  // missing native price as 0, exactly as these screens behaved before the Assets work.
  const valuesByVault = useMemo<SavingsValuesByVault | undefined>(() => {
    if (isLoading) return undefined;
    const fusePrice = hasFuseBalance ? Number(fusePriceUsd) || 0 : 0;
    const ethPrice = hasEthBalance ? Number(ethPriceUsd) || 0 : 0;
    return {
      [VaultType.USDC]: (balanceUsdc ?? 0) * (exchangeRateUsdc ?? 1),
      [VaultType.FUSE]: hasFuseBalance
        ? (balanceFuse ?? 0) * (exchangeRateFuse ?? 1) * fusePrice
        : 0,
      [VaultType.ETH]: hasEthBalance ? (balanceEth ?? 0) * (exchangeRateEth ?? 1) * ethPrice : 0,
    };
  }, [
    isLoading,
    hasFuseBalance,
    hasEthBalance,
    balanceUsdc,
    balanceFuse,
    balanceEth,
    exchangeRateUsdc,
    exchangeRateFuse,
    exchangeRateEth,
    fusePriceUsd,
    ethPriceUsd,
  ]);

  // Strict, per vault, for the Assets overview: a vault whose balance, rate or price is
  // unavailable is `undefined` on its own, never zero, and never blanks the other vaults.
  const exactValuesByVault = useMemo<ExactSavingsValuesByVault | undefined>(() => {
    if (isLoading) return undefined;
    return {
      [VaultType.USDC]: isErrorBalanceUsdc
        ? undefined
        : savingsUsdValue(balanceUsdc, exchangeRateUsdc),
      [VaultType.FUSE]: isErrorBalanceFuse
        ? undefined
        : savingsUsdValue(balanceFuse, exchangeRateFuse, Number(fusePriceUsd)),
      [VaultType.ETH]: isErrorBalanceEth
        ? undefined
        : savingsUsdValue(balanceEth, exchangeRateEth, Number(ethPriceUsd)),
    };
  }, [
    isLoading,
    isErrorBalanceUsdc,
    isErrorBalanceFuse,
    isErrorBalanceEth,
    balanceUsdc,
    balanceFuse,
    balanceEth,
    exchangeRateUsdc,
    exchangeRateFuse,
    exchangeRateEth,
    fusePriceUsd,
    ethPriceUsd,
  ]);

  // soEURC in EUR: shares × the soEURC→EURC rate, EURC read at par with the euro.
  // Same leniency as `valuesByVault` — a missing rate reads as 1:1.
  const isEurLoading = !!eurVault && (isLoadingBalanceEur || (hasEurBalance && isLoadingRateEur));
  const eurValue = !eurVault
    ? 0
    : isEurLoading
      ? undefined
      : (balanceEur ?? 0) * (exchangeRateEur ?? 1);

  // USD vaults only: soEURC is never summed into a dollar figure.
  const data = valuesByVault
    ? Object.values(valuesByVault).reduce((total, value) => total + value, 0)
    : undefined;

  return {
    data,
    valuesByVault,
    exactValuesByVault,
    eurValue,
    isEurLoading,
    isEurError: !!eurVault && (isErrorBalanceEur || (hasEurBalance && isErrorRateEur)),
    isLoading,
    isError:
      isErrorBalanceUsdc ||
      isErrorBalanceFuse ||
      isErrorBalanceEth ||
      ((balanceUsdc ?? 0) > 0 && isErrorRateUsdc) ||
      (hasFuseBalance && (isErrorRateFuse || isErrorFusePrice)) ||
      (hasEthBalance && (isErrorRateEth || isErrorEthPrice)) ||
      (!!exactValuesByVault && Object.values(exactValuesByVault).some(v => v === undefined)),
  };
};
