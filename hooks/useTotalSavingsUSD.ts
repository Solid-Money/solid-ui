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

const ACTIVE_VAULTS = VAULTS.filter(v => !('isComingSoon' in v && v.isComingSoon));
const usdcVault = ACTIVE_VAULTS[0];
const fuseVault = ACTIVE_VAULTS[1];
const ethVault = ACTIVE_VAULTS[2];

/**
 * Total redeemable savings in USD across ALL vaults: soUSD + soFUSE + soETH.
 * USDC uses its soUSD→USD rate directly; FUSE and ETH multiply their
 * soToken→native rate by the native token's USD price.
 */
type SavingsValuesByVault = Record<VaultType, number>;
export type ExactSavingsValuesByVault = Record<VaultType, number | undefined>;

export const useTotalSavingsUSD = (): {
  data: number | undefined;
  valuesByVault: SavingsValuesByVault | undefined;
  exactValuesByVault: ExactSavingsValuesByVault | undefined;
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

  const hasFuseBalance = !!fuseVault && (balanceFuse ?? 0) > 0;
  const hasEthBalance = !!ethVault && (balanceEth ?? 0) > 0;

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

  const data = valuesByVault
    ? Object.values(valuesByVault).reduce((total, value) => total + value, 0)
    : undefined;

  return {
    data,
    valuesByVault,
    exactValuesByVault,
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
