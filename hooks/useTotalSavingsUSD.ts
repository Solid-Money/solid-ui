import { useMemo } from 'react';
import { Address } from 'viem';
import { fuse, mainnet } from 'viem/chains';

import { VAULTS } from '@/constants/vaults';
import { useNativePriceQuery } from '@/hooks/useNativePriceUsd';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
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

export const useTotalSavingsUSD = (): {
  data: number | undefined;
  valuesByVault: SavingsValuesByVault | undefined;
  isLoading: boolean;
} => {
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
  const { data: balanceEth, isLoading: isLoadingBalanceEth } = useVaultBalance(
    address,
    ethVault ?? usdcVault,
  );

  const { data: exchangeRateUsdc, isLoading: isLoadingRateUsdc } = useVaultExchangeRate(
    usdcVault.name,
  );
  const { data: exchangeRateFuse, isLoading: isLoadingRateFuse } = useVaultExchangeRate(
    fuseVault?.name ?? usdcVault.name,
  );
  const { data: exchangeRateEth, isLoading: isLoadingRateEth } = useVaultExchangeRate(
    ethVault?.name ?? usdcVault.name,
  );

  const hasFuseBalance = !!fuseVault && (balanceFuse ?? 0) > 0;
  const hasEthBalance = !!ethVault && (balanceEth ?? 0) > 0;

  const { data: fusePriceUsd, isLoading: isLoadingFusePrice } = useNativePriceQuery(
    fuse.id,
    'fusePriceUsd',
    hasFuseBalance,
  );
  const { data: ethPriceUsd, isLoading: isLoadingEthPrice } = useNativePriceQuery(
    mainnet.id,
    'ethPriceUsd',
    hasEthBalance,
  );

  const isLoading =
    isLoadingBalanceUsdc ||
    isLoadingBalanceFuse ||
    isLoadingBalanceEth ||
    isLoadingRateUsdc ||
    (hasFuseBalance && (isLoadingRateFuse || isLoadingFusePrice)) ||
    (hasEthBalance && (isLoadingRateEth || isLoadingEthPrice));

  const valuesByVault = useMemo<SavingsValuesByVault | undefined>(() => {
    if (isLoading) return undefined;
    const rateUsdc = exchangeRateUsdc ?? 1;
    const rateFuse = exchangeRateFuse ?? 1;
    const rateEth = exchangeRateEth ?? 1;
    const fusePrice = hasFuseBalance ? Number(fusePriceUsd) || 0 : 0;
    const ethPrice = hasEthBalance ? Number(ethPriceUsd) || 0 : 0;
    const redeemableUsdc = (balanceUsdc ?? 0) * rateUsdc;
    const redeemableFuse = hasFuseBalance ? (balanceFuse ?? 0) * rateFuse * fusePrice : 0;
    const redeemableEth = hasEthBalance ? (balanceEth ?? 0) * rateEth * ethPrice : 0;
    return {
      [VaultType.USDC]: redeemableUsdc,
      [VaultType.FUSE]: redeemableFuse,
      [VaultType.ETH]: redeemableEth,
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

  const data = valuesByVault
    ? Object.values(valuesByVault).reduce((total, value) => total + value, 0)
    : undefined;

  return { data, valuesByVault, isLoading };
};
