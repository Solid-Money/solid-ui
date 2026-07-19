import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Address } from 'viem';
import { fuse, mainnet } from 'viem/chains';

import { NATIVE_COINGECKO_TOKENS, NATIVE_TOKENS } from '@/constants/tokens';
import { VAULTS } from '@/constants/vaults';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
import { fetchCoinSimplePrice, fetchTokenPriceUsd } from '@/lib/api';

const ACTIVE_VAULTS = VAULTS.filter(v => !('isComingSoon' in v && v.isComingSoon));
const usdcVault = ACTIVE_VAULTS[0];
const fuseVault = ACTIVE_VAULTS[1];
const ethVault = ACTIVE_VAULTS[2];

/**
 * Fetch a chain's native-token USD price (Alchemy first, CoinGecko fallback).
 * Used for the FUSE and ETH savings terms (their vault exchange rates are in
 * native units, unlike USDC whose soUSD→USD rate is already dollars).
 */
const makeNativePriceFetcher = (chainId: number) => async (): Promise<string | undefined> => {
  try {
    const price = await fetchTokenPriceUsd(NATIVE_TOKENS[chainId]);
    if (price != null && Number(price) > 0) return price;
  } catch {
    // fall through to CoinGecko
  }

  const coinId = NATIVE_COINGECKO_TOKENS[chainId];
  if (!coinId) return undefined;
  const priceMap = await fetchCoinSimplePrice([coinId]);
  const usd = priceMap[coinId]?.usd;
  return usd != null && usd > 0 ? String(usd) : undefined;
};

const fetchFusePrice = makeNativePriceFetcher(fuse.id);
const fetchEthPrice = makeNativePriceFetcher(mainnet.id);

/**
 * Total redeemable savings in USD across ALL vaults: soUSD + soFUSE + soETH.
 * USDC uses its soUSD→USD rate directly; FUSE and ETH multiply their
 * soToken→native rate by the native token's USD price.
 */
export const useTotalSavingsUSD = (): { data: number | undefined; isLoading: boolean } => {
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

  const { data: fusePriceUsd, isLoading: isLoadingFusePrice } = useQuery({
    queryKey: ['fusePriceUsd'],
    queryFn: fetchFusePrice,
    enabled: hasFuseBalance,
    staleTime: 5_000,
    refetchInterval: 5_000,
  });
  const { data: ethPriceUsd, isLoading: isLoadingEthPrice } = useQuery({
    queryKey: ['ethPriceUsd'],
    queryFn: fetchEthPrice,
    enabled: hasEthBalance,
    staleTime: 5_000,
    refetchInterval: 5_000,
  });

  const isLoading =
    isLoadingBalanceUsdc ||
    isLoadingBalanceFuse ||
    isLoadingBalanceEth ||
    isLoadingRateUsdc ||
    (hasFuseBalance && (isLoadingRateFuse || isLoadingFusePrice)) ||
    (hasEthBalance && (isLoadingRateEth || isLoadingEthPrice));

  const data = useMemo(() => {
    if (isLoading) return undefined;
    const rateUsdc = exchangeRateUsdc ?? 1;
    const rateFuse = exchangeRateFuse ?? 1;
    const rateEth = exchangeRateEth ?? 1;
    const fusePrice = hasFuseBalance ? Number(fusePriceUsd) || 0 : 0;
    const ethPrice = hasEthBalance ? Number(ethPriceUsd) || 0 : 0;
    const redeemableUsdc = (balanceUsdc ?? 0) * rateUsdc;
    const redeemableFuse = hasFuseBalance ? (balanceFuse ?? 0) * rateFuse * fusePrice : 0;
    const redeemableEth = hasEthBalance ? (balanceEth ?? 0) * rateEth * ethPrice : 0;
    return redeemableUsdc + redeemableFuse + redeemableEth;
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

  return { data, isLoading };
};
